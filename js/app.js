/**
 * Pusan National University Halloween Event UI & Funnel Handler
 */

document.addEventListener('DOMContentLoaded', () => {
  initCountdown();
  initSeatCounter();
  initCostumeVoting();
  initFunnelModal();
  initShareButtons();
  initSpookyAudio();
  initQuiz();
});

// 1. Countdown Timer to Halloween 2026-10-31 18:00
function initCountdown() {
  const targetDate = new Date('2026-10-31T18:00:00+09:00').getTime();

  function update() {
    const now = new Date().getTime();
    const diff = Math.max(0, targetDate - now);

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    const daysEl = document.getElementById('cd-days');
    const hoursEl = document.getElementById('cd-hours');
    const minsEl = document.getElementById('cd-mins');
    const secsEl = document.getElementById('cd-secs');

    if (daysEl) daysEl.textContent = String(d).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(h).padStart(2, '0');
    if (minsEl) minsEl.textContent = String(m).padStart(2, '0');
    if (secsEl) secsEl.textContent = String(s).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

// 2. Real-time Limited Tickets Counter
function initSeatCounter() {
  const remainingEl = document.getElementById('vip-remaining-count');
  if (!remainingEl) return;

  let count = parseInt(localStorage.getItem('pnu_hw_remaining_seats') || '14', 10);
  remainingEl.textContent = count;

  // Occasional random drop for FOMO simulation
  setInterval(() => {
    if (Math.random() < 0.25 && count > 3) {
      count -= 1;
      remainingEl.textContent = count;
      localStorage.setItem('pnu_hw_remaining_seats', count);
      remainingEl.classList.add('text-red-400', 'scale-110');
      setTimeout(() => remainingEl.classList.remove('scale-110'), 500);
    }
  }, 18000);
}

// 3. Costume Contest Voting Logic
function initCostumeVoting() {
  const voteBtns = document.querySelectorAll('.btn-vote-candidate');
  const votedKey = 'pnu_hw_voted_candidate';

  // Load initial vote counts from Supabase
  if (window.GrowthDB && typeof window.GrowthDB.fetchCostumeVotes === 'function') {
    window.GrowthDB.fetchCostumeVotes().then(counts => {
      updateVoteDisplay(counts);
    });
  }

  voteBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const candId = btn.getAttribute('data-candidate-id');
      const candName = btn.getAttribute('data-candidate-name');
      const trackId = `btn-vote-${candId}`;

      window.PNUTracker.trackButtonClick(trackId, `${candName} 투표`, 'costume_contest');

      // Check if already voted
      if (localStorage.getItem(votedKey)) {
        showToast('이미 투표에 참여하셨습니다! (1인 1표)', 'info');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin">⏳</span> 반영 중...`;

      const result = await window.GrowthDB.submitVote({
        session_id: window.PNUTracker.sessionId,
        candidate_id: candId,
        candidate_name: candName
      });

      if (result.success) {
        localStorage.setItem(votedKey, candId);
        showToast(`🎉 ${candName} 님에게 소중한 1표가 전달되었습니다!`, 'success');
        // Refresh counts
        const newCounts = await window.GrowthDB.fetchCostumeVotes();
        updateVoteDisplay(newCounts);
      } else {
        showToast('투표 저장 중 문제가 발생했습니다.', 'error');
        btn.disabled = false;
        btn.innerHTML = `투표하기`;
      }
    });
  });

  function updateVoteDisplay(counts) {
    let total = 0;
    Object.values(counts).forEach(v => total += v);
    if (total === 0) total = 4; // base placeholder

    ['c1', 'c2', 'c3', 'c4'].forEach(cid => {
      const cnt = counts[cid] || 0;
      const countEl = document.getElementById(`vote-count-${cid}`);
      const barEl = document.getElementById(`vote-bar-${cid}`);
      const pct = Math.round((cnt / (total || 1)) * 100);

      if (countEl) countEl.textContent = `${cnt}표 (${pct}%)`;
      if (barEl) barEl.style.width = `${pct}%`;
    });

    const hasVoted = localStorage.getItem(votedKey);
    if (hasVoted) {
      voteBtns.forEach(b => {
        b.disabled = true;
        if (b.getAttribute('data-candidate-id') === hasVoted) {
          b.classList.add('bg-green-600', 'border-green-500');
          b.textContent = '투표 완료 ✓';
        } else {
          b.classList.add('opacity-50');
          b.textContent = '투표 마감';
        }
      });
    }
  }
}

// 4. Funnel Modal & 5-Step Checkout Architecture
let currentOrderState = {
  packageType: 'SPOOKY',
  packageName: '스푸키 패키지 (방탈출 우선권 + 산지니 키링)',
  price: 5900,
  studentId: '',
  studentName: '',
  department: '',
  phone: '',
  paymentMethod: 'kakaopay'
};

function initFunnelModal() {
  const modal = document.getElementById('funnel-modal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const closeBtn = document.getElementById('btn-close-modal');

  // Package select buttons
  const pkgButtons = document.querySelectorAll('.btn-select-package');
  pkgButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pType = btn.getAttribute('data-package-type');
      const pName = btn.getAttribute('data-package-name');
      const pPrice = parseInt(btn.getAttribute('data-package-price') || '0', 10);

      currentOrderState.packageType = pType;
      currentOrderState.packageName = pName;
      currentOrderState.price = pPrice;

      // Track Step 3: Checkout Start
      window.PNUTracker.trackFunnelStep(3, 'checkout_start', {
        package_type: pType,
        package_name: pName,
        price: pPrice
      });

      openFunnelStep(3);
    });
  });

  // Step 3 -> 4: Click to open verification
  const toStep4Btn = document.getElementById('btn-step3-next');
  if (toStep4Btn) {
    toStep4Btn.addEventListener('click', () => {
      window.PNUTracker.trackButtonClick('btn-goto-step4', '학생 인증 단계로 이동', 'funnel_step3');
      openFunnelStep(4);
    });
  }

  // Step 4: Verification form submission
  const verifyForm = document.getElementById('student-verify-form');
  if (verifyForm) {
    verifyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const sId = document.getElementById('input-student-id').value.trim();
      const sName = document.getElementById('input-student-name').value.trim();
      const dept = document.getElementById('input-department').value.trim();
      const phone = document.getElementById('input-phone').value.trim();

      if (!sId || !sName || !dept || !phone) {
        showToast('모든 필수 정보를 입력해 주세요!', 'error');
        return;
      }

      // Simple PNU student ID format validation
      if (!/^\d{8,10}$/.test(sId)) {
        showToast('학번은 8~10자리 숫자로 입력해주세요 (예: 202412345)', 'error');
        return;
      }

      currentOrderState.studentId = sId;
      currentOrderState.studentName = sName;
      currentOrderState.department = dept;
      currentOrderState.phone = phone;

      // Track Step 4: Verification Complete
      window.PNUTracker.trackFunnelStep(4, 'student_verified', {
        student_id_prefix: sId.substring(0, 4),
        department: dept
      });

      // Prepare Step 5 payment confirmation
      openFunnelStep(5);
    });
  }

  // Step 5: Final Payment & Ticket Issuance
  const finalPayBtn = document.getElementById('btn-final-pay');
  if (finalPayBtn) {
    finalPayBtn.addEventListener('click', async () => {
      finalPayBtn.disabled = true;
      finalPayBtn.innerHTML = `<span>⏳ 모바일 티켓 발권 중...</span>`;

      const orderCode = 'PNU-HW-' + Math.floor(100000 + Math.random() * 900000);
      const selectedPay = document.querySelector('input[name="payment-method"]:checked')?.value || 'kakaopay';

      const orderPayload = {
        session_id: window.PNUTracker.sessionId,
        order_code: orderCode,
        student_id: currentOrderState.studentId,
        student_name: currentOrderState.studentName,
        department: currentOrderState.department,
        phone: currentOrderState.phone,
        package_type: currentOrderState.packageType,
        package_name: currentOrderState.packageName,
        quantity: 1,
        unit_price: currentOrderState.price,
        total_price: currentOrderState.price,
        payment_method: currentOrderState.price === 0 ? 'free_campus' : selectedPay,
        status: 'completed',
        ab_variant: window.PNUTracker.abVariant,
        utm_source: window.PNUTracker.utmData.utm_source,
        metadata: {
          timestamp: new Date().toISOString()
        }
      };

      // 1. Record order to Supabase
      const orderRes = await window.GrowthDB.recordOrder(orderPayload);

      // 2. Track Step 5: Purchase Complete (Conversion!)
      window.PNUTracker.trackFunnelStep(5, 'purchase_complete', {
        order_code: orderCode,
        total_price: currentOrderState.price,
        package_type: currentOrderState.packageType,
        payment_method: selectedPay
      });

      // 3. Show Success Screen with Digital Ticket
      showTicketSuccess(orderCode, orderPayload);
    });
  }

  // Modal Close
  function closeModal() {
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  window.openFunnelStep = function(stepNum) {
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');

    // Hide all step sections
    ['modal-step-3', 'modal-step-4', 'modal-step-5', 'modal-step-ticket'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    // Update Progress Indicator
    [3, 4, 5].forEach(num => {
      const ind = document.getElementById(`step-indicator-${num}`);
      if (ind) {
        if (num < stepNum) {
          ind.className = 'w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold';
          ind.innerHTML = '✓';
        } else if (num === stepNum) {
          ind.className = 'w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold ring-4 ring-orange-500/30';
          ind.innerHTML = String(num);
        } else {
          ind.className = 'w-7 h-7 rounded-full bg-gray-800 text-gray-400 border border-gray-700 flex items-center justify-center text-xs font-bold';
          ind.innerHTML = String(num);
        }
      }
    });

    if (stepNum === 3) {
      const s3 = document.getElementById('modal-step-3');
      if (s3) s3.classList.remove('hidden');
      document.getElementById('step3-package-title').textContent = currentOrderState.packageName;
      document.getElementById('step3-package-price').textContent = currentOrderState.price === 0 ? '무료 (재학생)' : `${currentOrderState.price.toLocaleString()}원`;
    } else if (stepNum === 4) {
      const s4 = document.getElementById('modal-step-4');
      if (s4) s4.classList.remove('hidden');
    } else if (stepNum === 5) {
      const s5 = document.getElementById('modal-step-5');
      if (s5) s5.classList.remove('hidden');
      document.getElementById('step5-package-name').textContent = currentOrderState.packageName;
      document.getElementById('step5-student-info').textContent = `${currentOrderState.studentName} (${currentOrderState.department} / ${currentOrderState.studentId})`;
      document.getElementById('step5-final-amount').textContent = currentOrderState.price === 0 ? '0원' : `${currentOrderState.price.toLocaleString()}원`;
    }
  };

  function showTicketSuccess(orderCode, payload) {
    ['modal-step-3', 'modal-step-4', 'modal-step-5'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    const ticketView = document.getElementById('modal-step-ticket');
    if (ticketView) {
      ticketView.classList.remove('hidden');
      document.getElementById('ticket-order-code').textContent = orderCode;
      document.getElementById('ticket-student').textContent = `${payload.student_name} (${payload.student_id})`;
      document.getElementById('ticket-dept').textContent = payload.department;
      document.getElementById('ticket-pkg').textContent = payload.package_name;
      document.getElementById('ticket-date').textContent = '2026.10.31 (금) 18:00~';
      document.getElementById('ticket-place').textContent = '부산대 넉넉한터 효원 야외광장';

      // Trigger Confetti
      launchHalloweenConfetti();
    }
  }
}

// 5. Confetti celebration
function launchHalloweenConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff7518', '#9d4edd', '#00ff88', '#ffffff', '#ff0055']
    });
  }
}

// 6. Share Buttons with Auto-UTM tags
function initShareButtons() {
  const shareKakao = document.getElementById('btn-share-kakao');
  const shareCopy = document.getElementById('btn-share-copy');
  const shareInsta = document.getElementById('btn-share-insta');

  if (shareCopy) {
    shareCopy.addEventListener('click', () => {
      const shareUrl = `${window.location.origin}${window.location.pathname}?utm_source=everytime&utm_medium=student_council&utm_campaign=halloween2026`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('🔗 에브리타임용 초대 링크가 복사되었습니다!', 'success');
        window.PNUTracker.trackButtonClick('btn-share-copy', '에브리타임 링크 복사', 'share_section');
      }).catch(() => {
        showToast('링크 복사에 실패했습니다.', 'error');
      });
    });
  }

  if (shareKakao) {
    shareKakao.addEventListener('click', () => {
      const shareUrl = `${window.location.origin}${window.location.pathname}?utm_source=kakaotalk&utm_medium=messenger&utm_campaign=halloween2026`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('🎃 카카오톡 공유 링크가 복사되었습니다!', 'success');
        window.PNUTracker.trackButtonClick('btn-share-kakao', '카카오톡 공유', 'share_section');
      });
    });
  }

  if (shareInsta) {
    shareInsta.addEventListener('click', () => {
      const shareUrl = `${window.location.origin}${window.location.pathname}?utm_source=instagram&utm_medium=story&utm_campaign=halloween2026`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('📸 인스타그램 스토리용 링크가 복사되었습니다!', 'success');
        window.PNUTracker.trackButtonClick('btn-share-insta', '인스타그램 링크 복사', 'share_section');
      });
    });
  }
}

// 7. Spooky Audio Synthesizer (Zero asset dependency)
function initSpookyAudio() {
  const soundBtn = document.getElementById('sound-toggle-btn');
  let audioCtx = null;
  let isMuted = true;

  if (!soundBtn) return;

  soundBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    if (!isMuted) {
      soundBtn.innerHTML = '🔊 <span class="hidden sm:inline">호러 사운드 ON</span>';
      soundBtn.classList.add('border-orange-500', 'text-orange-400');
      playSpookyChime();
    } else {
      soundBtn.innerHTML = '🔇 <span class="hidden sm:inline">호러 사운드 OFF</span>';
      soundBtn.classList.remove('border-orange-500', 'text-orange-400');
    }
  });

  function playSpookyChime() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.8);

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      console.warn("AudioContext error:", e);
    }
  }
}

// 8. Halloween Mini Quiz (Engagement hook)
function initQuiz() {
  const quizForm = document.getElementById('pnu-quiz-form');
  if (!quizForm) return;

  quizForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const answer = document.querySelector('input[name="quiz-answer"]:checked')?.value;
    const resBox = document.getElementById('quiz-result');

    window.PNUTracker.trackButtonClick('btn-submit-quiz', '할로윈 퀴즈 제출', 'mini_quiz', {
      user_answer: answer
    });

    if (answer === 'sanjini') {
      resBox.innerHTML = `
        <div class="p-4 rounded-xl bg-green-950/60 border border-green-500 text-green-300 text-sm">
          🎉 <strong>정답입니다!</strong> 부산대학교의 영원한 수호신은 '산지니'입니다!<br/>
          호러 굿즈 부스 방문 시 <strong>마녀 사탕 1봉지</strong>가 증정됩니다! 🍬
        </div>
      `;
    } else {
      resBox.innerHTML = `
        <div class="p-4 rounded-xl bg-red-950/60 border border-red-500 text-red-300 text-sm">
          👻 <strong>아쉬워요!</strong> 정답은 부산대의 상징 '산지니' 독수리였습니다! 다시 도전해보세요!
        </div>
      `;
    }
  });
}

// Global Toast Notification Helper
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgStyles = type === 'success' ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                 : type === 'error' ? 'bg-rose-950 border-rose-500 text-rose-200'
                 : 'bg-zinc-900 border-zinc-700 text-zinc-100';

  toast.className = `p-3 rounded-xl border shadow-2xl backdrop-blur-md text-sm pointer-events-auto transform translate-y-3 opacity-0 transition-all duration-300 flex items-center justify-between ${bgStyles}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
  `;

  toast.querySelector('button').addEventListener('click', () => toast.remove());
  toastContainer.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-y-3', 'opacity-0');
  }, 10);

  // Auto dismiss
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-3');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
