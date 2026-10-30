/**
 * Growth Hacking Tracking Engine
 * Pusan National University Halloween Event
 */

(function () {
  'use strict';

  // 1. Session & Identity Management
  const STORAGE_KEYS = {
    SESSION_ID: 'pnu_hw_session_id',
    FIRST_SEEN: 'pnu_hw_first_seen',
    UTM_DATA: 'pnu_hw_utm_data',
    AB_VARIANT: 'pnu_hw_ab_variant',
    FUNNEL_REACHED: 'pnu_hw_funnel_reached',
    SCROLL_DEPTHS: 'pnu_hw_scroll_depths'
  };

  function getOrCreateSessionId() {
    let sid = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    if (!sid) {
      sid = 'pnu_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, sid);
      localStorage.setItem(STORAGE_KEYS.FIRST_SEEN, new Date().toISOString());
    }
    return sid;
  }

  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  // 2. UTM Parameter Extraction
  function getUtmData() {
    const urlParams = new URLSearchParams(window.location.search);
    const existing = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.UTM_DATA) || '{}');

    const utm = {
      utm_source: urlParams.get('utm_source') || existing.utm_source || 'direct',
      utm_medium: urlParams.get('utm_medium') || existing.utm_medium || (document.referrer ? 'referrer' : 'direct'),
      utm_campaign: urlParams.get('utm_campaign') || existing.utm_campaign || 'halloween_2026',
      referrer: document.referrer || existing.referrer || ''
    };

    sessionStorage.setItem(STORAGE_KEYS.UTM_DATA, JSON.stringify(utm));
    return utm;
  }

  // 3. A/B Testing Variant Split (50% A / 50% B) - assigned per session
  function getOrAssignAbVariant() {
    let variant = sessionStorage.getItem(STORAGE_KEYS.AB_VARIANT);
    if (!variant) {
      variant = Math.random() < 0.5 ? 'A' : 'B';
      sessionStorage.setItem(STORAGE_KEYS.AB_VARIANT, variant);
    }
    return variant;
  }

  const sessionId = getOrCreateSessionId();
  const utmData = getUtmData();
  const abVariant = getOrAssignAbVariant();
  const deviceType = getDeviceType();

  // Public Tracker API
  window.PNUTracker = {
    sessionId,
    utmData,
    abVariant,
    deviceType,

    // Core event tracking dispatcher
    track: function (eventName, options = {}) {
      const payload = {
        session_id: sessionId,
        event_type: options.event_type || 'custom',
        event_name: eventName,
        funnel_step: options.funnel_step || null,
        button_id: options.button_id || null,
        button_text: options.button_text || null,
        page_url: window.location.href,
        referrer: utmData.referrer,
        utm_source: utmData.utm_source,
        utm_medium: utmData.utm_medium,
        utm_campaign: utmData.utm_campaign,
        ab_variant: abVariant,
        device_type: deviceType,
        metadata: options.metadata || {}
      };

      console.log(`[📊 Tracker Track]`, eventName, payload);
      if (window.GrowthDB && typeof window.GrowthDB.sendEvent === 'function') {
        window.GrowthDB.sendEvent(payload);
      }
    },

    // Step-by-step Funnel Tracker (Steps 1 to 5)
    trackFunnelStep: function (stepNumber, stepName, extraMetadata = {}) {
      const reached = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.FUNNEL_REACHED) || '{}');
      reached[stepNumber] = true;
      sessionStorage.setItem(STORAGE_KEYS.FUNNEL_REACHED, JSON.stringify(reached));

      this.track(`funnel_step_${stepNumber}_${stepName}`, {
        event_type: 'funnel_step',
        funnel_step: stepNumber,
        metadata: {
          step_name: stepName,
          ...extraMetadata
        }
      });
    },

    // Button / CTA Click Tracker
    trackButtonClick: function (buttonId, buttonText, location = 'page', extraMetadata = {}) {
      this.track(`btn_click_${buttonId}`, {
        event_type: 'button_click',
        button_id: buttonId,
        button_text: buttonText,
        metadata: {
          location,
          ...extraMetadata
        }
      });
    },

    // Raw event_logs table logger (growth hacking funnel events)
    logToEventLogs: function (eventName, funnelStep, targetId) {
      const record = {
        session_id: sessionId,
        variant: abVariant,
        funnel_step: funnelStep || 'landing',
        event_name: eventName,
        target_id: targetId || null
      };

      console.log(`[🎃 EventLogs]`, record);
      if (window.GrowthDB && typeof window.GrowthDB.logEventLog === 'function') {
        window.GrowthDB.logEventLog(record);
      }
    }
  };

  // 4. Automatic DOM Listeners & Enhancements
  document.addEventListener('DOMContentLoaded', () => {
    // Apply A/B Testing Content into DOM
    applyAbTestingVariants(abVariant);

    // Track Step 1: Landing Page View
    window.PNUTracker.trackFunnelStep(1, 'landing_view', {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language
    });

    // Log raw landing event into event_logs
    window.PNUTracker.logToEventLogs('page_view', 'landing', null);

    // Global Click Delegation for any element with data-track-id
    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-track-id], button, .trackable-cta');
      if (!target) return;

      const trackId = target.getAttribute('data-track-id') || target.id || 'unlabeled_button';
      const trackText = target.getAttribute('data-track-name') || target.innerText.trim().slice(0, 40);
      const trackSection = target.closest('section')?.id || 'header_or_nav';

      window.PNUTracker.trackButtonClick(trackId, trackText, trackSection);
    }, true);

    // Track Scroll Depths (25%, 50%, 75%, 100%)
    setupScrollTracking();

    // Track Step 2 on intersection with the packages/programs section
    setupPackageIntersectionObserver();
  });

  // A/B Variant DOM Modifier
  function applyAbTestingVariants(variant) {
    document.documentElement.setAttribute('data-ab-variant', variant);
    const variantBadges = document.querySelectorAll('.ab-variant-tag');
    variantBadges.forEach(el => {
      el.textContent = `A/B Variant [${variant}]`;
    });

    const heroTitle = document.getElementById('hero-title');
    const heroSubtitle = document.getElementById('hero-subtitle');
    const heroCta = document.getElementById('hero-cta-btn');

    if (variant === 'B') {
      // Variant B: Urgency & High-Discount Angle
      if (heroTitle) {
        heroTitle.innerHTML = `🔥 <span class="text-orange-500">단 하루 50% 한정</span><br/>넉터의 밤 효원 호러 페스타`;
      }
      if (heroSubtitle) {
        heroSubtitle.textContent = `선착순 100명 얼리버드 한정 굿즈 패키지 증정! 지금 매진되기 전에 예약하세요.`;
      }
      if (heroCta) {
        heroCta.innerHTML = `<span>⚡ 지금 얼리버드 50% 혜택받기</span>`;
        heroCta.classList.add('pulse-glow');
      }

      // Show time attack banner + retention share button
      const timeAttackBanner = document.getElementById('time-attack-banner');
      if (timeAttackBanner) {
        timeAttackBanner.classList.remove('hidden');
        initTimeAttackBanner();
      }
    } else {
      // Variant A: Atmospheric Festival & Tradition Angle
      if (heroTitle) {
        heroTitle.innerHTML = `🎃 <span class="text-purple-400">2026 부산대학교</span><br/>효원 할로윈 페스타: 넉터의 밤`;
      }
      if (heroSubtitle) {
        heroSubtitle.textContent = `부산대 총학생회가 준비한 가을밤의 스릴! 방탈출, 코스튬 런웨이, 산지니 한정 굿즈까지`;
      }
      if (heroCta) {
        heroCta.innerHTML = `<span>🎃 할로윈 페키지 사전예약</span>`;
      }
    }
  }

  // B-Variant: 3-hour time attack banner countdown + tracked click listeners
  function initTimeAttackBanner() {
    const banner = document.getElementById('time-attack-banner');
    const timerEl = document.getElementById('time-attack-timer');
    if (!banner) return;

    const START_KEY = 'pnu_hw_timeattack_start';
    const DURATION_MS = 3 * 60 * 60 * 1000;

    let startTs = parseInt(sessionStorage.getItem(START_KEY) || '0', 10);
    if (!startTs) {
      startTs = Date.now();
      sessionStorage.setItem(START_KEY, String(startTs));
    }

    const intervalId = setInterval(() => {
      const remaining = Math.max(0, DURATION_MS - (Date.now() - startTs));
      if (timerEl) {
        const h = String(Math.floor(remaining / 3600000)).padStart(2, '0');
        const m = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0');
        const s = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
        timerEl.textContent = `${h}:${m}:${s}`;
      }
      if (remaining <= 0) {
        clearInterval(intervalId);
        banner.classList.add('hidden');
      }
    }, 1000);

    // Time attack banner click -> event_logs (time_attack_click)
    const attackBtn = document.getElementById('banner-timeattack-990');
    if (attackBtn) {
      attackBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.PNUTracker.logToEventLogs('time_attack_click', 'landing', 'banner-timeattack-990');
        const pkgSection = document.getElementById('packages-section');
        if (pkgSection) pkgSection.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Retention share button click -> event_logs (share_click)
    const shareBtn = document.getElementById('btn-share-discount');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        window.PNUTracker.logToEventLogs('share_click', 'landing', 'btn-share-discount');

        const shareUrl = `${window.location.origin}${window.location.pathname}?utm_source=friend_share&utm_medium=retention&utm_campaign=halloween2026`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            if (typeof showToast === 'function') {
              showToast('🎁 친구 공유 50% 할인 링크가 복사되었습니다!', 'success');
            }
          }).catch(() => {
            if (typeof showToast === 'function') {
              showToast('링크 복사에 실패했습니다.', 'error');
            }
          });
        }
      });
    }
  }

  // Scroll Tracking
  function setupScrollTracking() {
    const trackedThresholds = new Set();
    const thresholds = [25, 50, 75, 95];

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (docHeight <= 0) return;

          const scrollPercent = Math.min(100, Math.round((scrollTop / docHeight) * 100));

          thresholds.forEach(th => {
            if (scrollPercent >= th && !trackedThresholds.has(th)) {
              trackedThresholds.add(th);
              window.PNUTracker.track(`scroll_depth_${th}`, {
                event_type: 'scroll_depth',
                metadata: { depth_percent: th }
              });
            }
          });
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // Track Funnel Step 2 on Packages view
  function setupPackageIntersectionObserver() {
    const packageSection = document.getElementById('packages-section') || document.getElementById('programs-section');
    if (!packageSection || !('IntersectionObserver' in window)) return;

    let hasTracked = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !hasTracked) {
          hasTracked = true;
          window.PNUTracker.trackFunnelStep(2, 'explore_packages');
          window.PNUTracker.logToEventLogs('page_view', 'detail_view', null);
          observer.disconnect();
        }
      });
    }, { threshold: 0.25 });

    observer.observe(packageSection);
  }

})();
