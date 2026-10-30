/**
 * Growth Hacking Analytics Dashboard
 * Real-time Funnel Drop-off, Button Clicks, and Conversion Metrics
 */

document.addEventListener('DOMContentLoaded', () => {
  initDashboardUI();
});

let isDashboardActive = false;
let dashboardRefreshTimer = null;

function initDashboardUI() {
  const toggleBtn = document.getElementById('btn-toggle-dashboard');
  const dashboardView = document.getElementById('growth-dashboard-view');
  const mainSiteView = document.getElementById('main-site-view');
  const refreshBtn = document.getElementById('btn-refresh-dashboard');
  const seedBtn = document.getElementById('btn-seed-traffic');
  const backToSiteBtn = document.getElementById('btn-back-to-site');

  function openDashboard() {
    isDashboardActive = true;
    mainSiteView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    toggleBtn.innerHTML = `🏠 <span class="hidden sm:inline">이벤트 페이지로</span>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadDashboardData();

    // Start auto refresh
    if (!dashboardRefreshTimer) {
      dashboardRefreshTimer = setInterval(() => {
        if (isDashboardActive) loadDashboardData(true);
      }, 15000);
    }
  }

  function closeDashboard() {
    isDashboardActive = false;
    dashboardView.classList.add('hidden');
    mainSiteView.classList.remove('hidden');
    toggleBtn.innerHTML = `📊 <span class="hidden sm:inline">그로스 데이터</span>`;
    if (dashboardRefreshTimer) {
      clearInterval(dashboardRefreshTimer);
      dashboardRefreshTimer = null;
    }
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (isDashboardActive) closeDashboard();
      else openDashboard();
    });
  }

  if (backToSiteBtn) {
    backToSiteBtn.addEventListener('click', closeDashboard);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('animate-spin');
      loadDashboardData().finally(() => {
        setTimeout(() => refreshBtn.classList.remove('animate-spin'), 600);
      });
    });
  }

  if (seedBtn) {
    seedBtn.addEventListener('click', async () => {
      seedBtn.disabled = true;
      seedBtn.innerHTML = `<span>⏳ 30명 가상 트래픽 생성 중...</span>`;
      
      const res = await window.GrowthDB.seedTraffic(30);
      seedBtn.disabled = false;
      seedBtn.innerHTML = `⚡ <span>가상 학생 30명 트래픽 시뮬레이션</span>`;

      if (res.success) {
        if (typeof showToast === 'function') {
          showToast(`🚀 가상 학생 30명의 퍼널 & 클릭 데이터가 Supabase에 생성되었습니다!`, 'success');
        }
        loadDashboardData();
      } else {
        if (typeof showToast === 'function') {
          showToast(`시뮬레이션 데이터 생성 실패: ${res.error}`, 'error');
        }
      }
    });
  }
}

async function loadDashboardData(isSilent = false) {
  const statusEl = document.getElementById('dashboard-sync-status');
  if (statusEl && !isSilent) statusEl.textContent = '데이터 동기화 중...';

  try {
    const metrics = await window.GrowthDB.fetchMetrics();
    const recentEvents = await window.GrowthDB.fetchRecentEvents(15);

    if (metrics) {
      renderSummaryCards(metrics);
      renderFunnelChart(metrics.funnel, metrics.total_sessions);
      renderButtonClicksTable(metrics.button_clicks);
      renderUtmAttribution(metrics.utm_sources);
      renderAbTestComparison(metrics.ab_test);
      renderRecentEventStream(recentEvents);
    }

    if (statusEl) {
      const now = new Date();
      statusEl.textContent = `Supabase 실시간 연동됨 (${now.toLocaleTimeString()})`;
    }
  } catch (err) {
    console.error("Dashboard render failed:", err);
    if (statusEl) statusEl.textContent = '동기화 오류 발생';
  }
}

// 1. KPI Summary Cards
function renderSummaryCards(metrics) {
  const totalVisitorsEl = document.getElementById('kpi-total-visitors');
  const totalRevenueEl = document.getElementById('kpi-total-revenue');
  const totalOrdersEl = document.getElementById('kpi-total-orders');
  const conversionRateEl = document.getElementById('kpi-conversion-rate');
  const aovEl = document.getElementById('kpi-aov');

  const totalSessions = metrics.total_sessions || 0;
  const totalOrders = metrics.orders?.total_orders || 0;
  const totalRev = metrics.orders?.total_revenue || 0;
  const aov = metrics.orders?.avg_order_value || 0;
  const cr = totalSessions > 0 ? ((totalOrders / totalSessions) * 100).toFixed(1) : '0.0';

  if (totalVisitorsEl) totalVisitorsEl.textContent = totalSessions.toLocaleString();
  if (totalRevenueEl) totalRevenueEl.textContent = `₩${totalRev.toLocaleString()}`;
  if (totalOrdersEl) totalOrdersEl.textContent = totalOrders.toLocaleString();
  if (conversionRateEl) conversionRateEl.textContent = `${cr}%`;
  if (aovEl) aovEl.textContent = `₩${aov.toLocaleString()}`;
}

// 2. Funnel Drop-off Rate Visualizer (Key Requirement)
function renderFunnelChart(funnelSteps, totalSessions) {
  const container = document.getElementById('funnel-steps-container');
  const bottleneckEl = document.getElementById('funnel-bottleneck-insight');
  if (!container) return;

  container.innerHTML = '';
  if (!funnelSteps || funnelSteps.length === 0) {
    container.innerHTML = '<div class="text-gray-400 p-4 text-center">수집된 퍼널 데이터가 아직 없습니다.</div>';
    return;
  }

  const baseCount = funnelSteps[0]?.session_count || 0;
  let maxDropoffStep = null;
  let maxDropoffRate = -1;

  funnelSteps.forEach((step, idx) => {
    const currentCount = step.session_count || 0;
    const prevCount = idx === 0 ? currentCount : (funnelSteps[idx - 1]?.session_count || 0);

    // Step-to-Step Drop-off Rate (%)
    const dropoffCount = Math.max(0, prevCount - currentCount);
    const dropoffRate = prevCount > 0 ? Math.round((dropoffCount / prevCount) * 100) : 0;

    // Overall Conversion from Base (%)
    const overallRate = baseCount > 0 ? Math.round((currentCount / baseCount) * 100) : (idx === 0 && currentCount > 0 ? 100 : 0);

    // Track highest bottleneck (excluding step 1)
    if (idx > 0 && dropoffRate > maxDropoffRate) {
      maxDropoffRate = dropoffRate;
      maxDropoffStep = step;
    }

    const stepBar = document.createElement('div');
    stepBar.className = 'relative flex flex-col gap-2 p-4 rounded-xl bg-gray-900/80 border border-gray-800 transition hover:border-gray-700';

    stepBar.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          <span class="w-6 h-6 rounded-full bg-purple-900/60 text-purple-300 border border-purple-500/40 flex items-center justify-center text-xs font-bold">${step.step}</span>
          <span class="font-bold text-gray-200 text-sm sm:text-base">${step.name}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-gray-400">도달 세션:</span>
          <span class="text-base font-extrabold text-orange-400 font-mono">${currentCount.toLocaleString()}명</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">전환율 ${overallRate}%</span>
          ${idx > 0 ? `
            <span class="text-xs px-2 py-0.5 rounded-full ${dropoffRate > 40 ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse' : 'bg-amber-950 text-amber-300 border border-amber-800'}">
              📉 이탈율 ${dropoffRate}% (-${dropoffCount}명)
            </span>
          ` : '<span class="text-xs text-gray-500 px-2 py-0.5">퍼널 시작</span>'}
        </div>
      </div>

      <!-- Funnel Progress Bar -->
      <div class="w-full bg-gray-800 h-3 rounded-full overflow-hidden mt-1 relative flex">
        <div class="bg-gradient-to-r from-orange-500 to-amber-400 h-full rounded-full transition-all duration-700" style="width: ${overallRate}%"></div>
      </div>
    `;

    container.appendChild(stepBar);
  });

  // Highlight Growth Hacking Bottleneck
  if (bottleneckEl && maxDropoffStep) {
    bottleneckEl.innerHTML = `
      <div class="flex items-start gap-3 p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200">
        <span class="text-2xl">🚨</span>
        <div>
          <h4 class="font-bold text-sm text-amber-100">최대 이탈 구간 분석 (Bottleneck Detection)</h4>
          <p class="text-xs text-amber-300 mt-1">
            <strong>[${maxDropoffStep.name}]</strong> 단계에서 직전 단계 대비 
            <span class="font-bold text-rose-400 text-sm">${maxDropoffRate}%</span>의 유저가 이탈하고 있습니다.
            ${maxDropoffStep.step === 4 
              ? '👉 학번/학과 입력 단계에서 이탈이 큽니다. "에브리타임 간편 로그인" 또는 "학과 자동완성" 기능 도입 시 전환율이 약 18~25% 개선될 수 있습니다.' 
              : '👉 CTA 버튼 카피 개선 및 패키지 혜택 가시성을 높이는 A/B 테스트를 추천합니다.'}
          </p>
        </div>
      </div>
    `;
  }
}

// 3. Button Click Ranking
function renderButtonClicksTable(buttons) {
  const container = document.getElementById('button-clicks-container');
  if (!container) return;

  container.innerHTML = '';
  if (!buttons || buttons.length === 0) {
    container.innerHTML = '<div class="text-gray-400 p-4 text-center">버튼 클릭 데이터가 아직 없습니다.</div>';
    return;
  }

  const maxClick = buttons[0]?.click_count || 1;

  buttons.forEach((btn, idx) => {
    const row = document.createElement('div');
    const pct = Math.round((btn.click_count / maxClick) * 100);

    row.className = 'flex items-center gap-3 p-2.5 rounded-lg bg-gray-900/60 border border-gray-800 text-xs sm:text-sm';
    row.innerHTML = `
      <span class="w-6 text-center font-bold font-mono ${idx === 0 ? 'text-amber-400 text-base' : idx === 1 ? 'text-gray-300' : 'text-gray-500'}">#${idx + 1}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <span class="font-semibold text-gray-200 truncate">${btn.button_text || btn.button_id}</span>
          <span class="font-mono text-orange-400 font-bold ml-2">${btn.click_count.toLocaleString()}회</span>
        </div>
        <div class="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
          <div class="bg-indigo-500 h-full rounded-full" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
    container.appendChild(row);
  });
}

// 4. UTM Source Attribution
function renderUtmAttribution(utmSources) {
  const container = document.getElementById('utm-sources-container');
  if (!container) return;

  container.innerHTML = '';
  if (!utmSources || utmSources.length === 0) {
    container.innerHTML = '<div class="text-gray-400 p-4 text-center">유입 채널 데이터가 아직 없습니다.</div>';
    return;
  }

  utmSources.forEach(utm => {
    const cr = utm.visitors > 0 ? Math.round((utm.buyers / utm.visitors) * 100) : 0;
    const card = document.createElement('div');
    card.className = 'p-3 rounded-xl bg-gray-900/60 border border-gray-800 flex items-center justify-between';

    const sourceNames = {
      everytime: '📢 에브리타임 (Everytime)',
      instagram: '📸 인스타그램 (@pnu_student)',
      campus_qr: '📌 캠퍼스 대자보 QR코드',
      kakaotalk: '💬 카카오톡 오픈채팅',
      direct: '🔗 직접 유입 (Direct URL)'
    };

    const displayName = sourceNames[utm.source] || `🌐 ${utm.source}`;

    card.innerHTML = `
      <div>
        <p class="font-bold text-xs sm:text-sm text-gray-200">${displayName}</p>
        <p class="text-xs text-gray-400 mt-0.5">방문자: <span class="text-white font-mono font-bold">${utm.visitors}명</span> | 구매: <span class="text-white font-mono font-bold">${utm.buyers}건</span></p>
      </div>
      <div class="text-right">
        <span class="text-xs px-2.5 py-1 rounded-full ${cr >= 20 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-gray-800 text-gray-300'} font-bold">
          전환율 ${cr}%
        </span>
      </div>
    `;
    container.appendChild(card);
  });
}

// 5. A/B Test Variant Comparison
function renderAbTestComparison(abList) {
  const container = document.getElementById('ab-test-container');
  if (!container) return;

  const aData = abList?.find(x => x.variant === 'A') || { visitors: 0, buyers: 0 };
  const bData = abList?.find(x => x.variant === 'B') || { visitors: 0, buyers: 0 };

  const aCr = aData.visitors > 0 ? ((aData.buyers / aData.visitors) * 100).toFixed(1) : '0.0';
  const bCr = bData.visitors > 0 ? ((bData.buyers / bData.visitors) * 100).toFixed(1) : '0.0';

  const diff = (parseFloat(bCr) - parseFloat(aCr)).toFixed(1);
  const isBWinning = parseFloat(bCr) > parseFloat(aCr);

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <!-- Variant A -->
      <div class="p-4 rounded-xl bg-gray-900/70 border ${!isBWinning && parseFloat(aCr) > 0 ? 'border-green-500/60 ring-2 ring-green-500/20' : 'border-gray-800'}">
        <div class="flex items-center justify-between mb-2">
          <span class="px-2 py-0.5 rounded text-xs font-bold bg-blue-900/60 text-blue-300 border border-blue-600/40">Variant A</span>
          ${!isBWinning && parseFloat(aCr) > 0 ? '<span class="text-xs text-green-400 font-bold">🏆 현재 우세</span>' : ''}
        </div>
        <h5 class="text-xs text-gray-400 font-medium">카피 컨셉: 전통 축제 & 페스타 감성</h5>
        <div class="mt-3 flex items-baseline justify-between">
          <div>
            <p class="text-2xl font-black text-white font-mono">${aCr}%</p>
            <p class="text-xs text-gray-500 mt-0.5">구매 전환율 (CR)</p>
          </div>
          <div class="text-right text-xs text-gray-400">
            <p>방문: <span class="text-gray-200 font-bold">${aData.visitors}명</span></p>
            <p>구매: <span class="text-gray-200 font-bold">${aData.buyers}건</span></p>
          </div>
        </div>
      </div>

      <!-- Variant B -->
      <div class="p-4 rounded-xl bg-gray-900/70 border ${isBWinning ? 'border-orange-500/60 ring-2 ring-orange-500/20' : 'border-gray-800'}">
        <div class="flex items-center justify-between mb-2">
          <span class="px-2 py-0.5 rounded text-xs font-bold bg-orange-900/60 text-orange-300 border border-orange-600/40">Variant B</span>
          ${isBWinning ? '<span class="text-xs text-orange-400 font-bold">🏆 현재 우세 (+'+diff+'%p)</span>' : ''}
        </div>
        <h5 class="text-xs text-gray-400 font-medium">카피 컨셉: 얼리버드 50% & 긴박감 FOMO</h5>
        <div class="mt-3 flex items-baseline justify-between">
          <div>
            <p class="text-2xl font-black text-white font-mono">${bCr}%</p>
            <p class="text-xs text-gray-500 mt-0.5">구매 전환율 (CR)</p>
          </div>
          <div class="text-right text-xs text-gray-400">
            <p>방문: <span class="text-gray-200 font-bold">${bData.visitors}명</span></p>
            <p>구매: <span class="text-gray-200 font-bold">${bData.buyers}건</span></p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 6. Real-time Event Stream
function renderRecentEventStream(events) {
  const container = document.getElementById('recent-events-stream');
  if (!container) return;

  container.innerHTML = '';
  if (!events || events.length === 0) {
    container.innerHTML = '<div class="text-gray-500 p-3 text-center text-xs">수신된 실시간 이벤트가 없습니다.</div>';
    return;
  }

  events.forEach(ev => {
    const item = document.createElement('div');
    const timeStr = new Date(ev.created_at).toLocaleTimeString();
    const typeBadge = ev.event_type === 'funnel_step' ? '<span class="text-amber-400 font-mono">[FUNNEL]</span>'
                    : ev.event_type === 'button_click' ? '<span class="text-indigo-400 font-mono">[CLICK]</span>'
                    : '<span class="text-gray-400 font-mono">[EVENT]</span>';

    item.className = 'py-1.5 px-2 text-xs font-mono text-gray-300 flex items-center justify-between border-b border-gray-800/60 hover:bg-gray-800/30';
    item.innerHTML = `
      <div class="flex items-center gap-2 truncate">
        ${typeBadge}
        <span class="text-white font-semibold">${ev.event_name}</span>
        ${ev.button_id ? `<span class="text-gray-500">(${ev.button_id})</span>` : ''}
      </div>
      <div class="flex items-center gap-2 text-gray-500 shrink-0 ml-2">
        <span class="text-2xs px-1.5 py-0.2 rounded bg-gray-800 text-gray-400">${ev.utm_source || 'direct'}</span>
        <span>${timeStr}</span>
      </div>
    `;
    container.appendChild(item);
  });
}
