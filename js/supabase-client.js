/**
 * Supabase Client & Growth Hacking Event Dispatcher
 * Pusan National University Student Council - Halloween Event
 */

const SUPABASE_CONFIG = {
  url: "https://erxywsykhsceqyrtsvdm.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyeHl3c3lraHNjZXF5cnRzdmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyODk2NDEsImV4cCI6MjEwODg2NTY0MX0.Wfxv7SP6B8bKbXJC6UJUpTQTBnzvxywf3PnoNzKqRUg"
};

// Initialize Supabase instance using CDN window.supabase
let sbClient = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    sbClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    console.log("[Supabase] Successfully connected to PNU Halloween Growth DB");
  } else {
    console.warn("[Supabase] Library not found yet, will retry upon script load.");
  }
} catch (err) {
  console.error("[Supabase] Initialization error:", err);
}

// Queue for failed or offline requests
const OFFLINE_QUEUE_KEY = "pnu_halloween_pending_events";

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(-100)));
  } catch (e) {}
}

async function flushOfflineQueue() {
  if (!sbClient) return;
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  try {
    const { error } = await sbClient.from('analytics_events').insert(queue);
    if (!error) {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      console.log(`[Growth] Flushed ${queue.length} queued events to Supabase`);
    }
  } catch (err) {
    console.warn("[Growth] Queue flush deferred:", err.message);
  }
}

/**
 * Log growth analytics event to Supabase
 */
async function sendEventToSupabase(payload) {
  if (!sbClient) {
    if (window.supabase) {
      sbClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    }
  }

  // Ensure metadata is valid JSON
  const eventRecord = {
    session_id: payload.session_id,
    event_type: payload.event_type || 'custom',
    event_name: payload.event_name,
    funnel_step: payload.funnel_step || null,
    button_id: payload.button_id || null,
    button_text: payload.button_text || null,
    page_url: payload.page_url || window.location.href,
    referrer: payload.referrer || document.referrer || '',
    utm_source: payload.utm_source || 'direct',
    utm_medium: payload.utm_medium || null,
    utm_campaign: payload.utm_campaign || null,
    ab_variant: payload.ab_variant || 'A',
    device_type: payload.device_type || 'desktop',
    metadata: payload.metadata || {}
  };

  try {
    if (!sbClient) throw new Error("Supabase client uninitialized");
    const { error } = await sbClient.from('analytics_events').insert([eventRecord]);
    if (error) throw error;
    // Attempt flush
    flushOfflineQueue();
    return { success: true };
  } catch (err) {
    console.warn("[Growth Event Buffer] Network/DB issue, caching locally:", err.message);
    const q = getOfflineQueue();
    q.push(eventRecord);
    saveOfflineQueue(q);
    return { success: false, queued: true };
  }
}

/**
 * Record a new order / ticket booking
 */
async function recordOrderToSupabase(orderData) {
  if (!sbClient) {
    if (window.supabase) {
      sbClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    }
  }

  try {
    const { data, error } = await sbClient.from('orders').insert([orderData]).select().single();
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error("[Orders] Failed to create order:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Submit vote for costume contest
 */
async function submitCostumeVoteToSupabase(voteData) {
  if (!sbClient) {
    if (window.supabase) {
      sbClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    }
  }

  try {
    const { data, error } = await sbClient.from('costume_votes').insert([voteData]);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("[Vote] Failed to submit vote:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch costume vote counts
 */
async function fetchCostumeVotes() {
  if (!sbClient) return {};
  try {
    const { data, error } = await sbClient.from('costume_votes').select('candidate_id');
    if (error) throw error;
    const counts = {};
    (data || []).forEach(v => {
      counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1;
    });
    return counts;
  } catch (err) {
    console.error("[Vote] Fetch counts failed:", err);
    return {};
  }
}

/**
 * Fetch Growth Hacking Metrics (Funnel, Buttons, Conversion Rate, UTM)
 */
async function fetchGrowthMetricsFromDB() {
  if (!sbClient) {
    if (window.supabase) {
      sbClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    }
  }

  if (!sbClient) return null;

  try {
    // 1. Try calling the PostgreSQL RPC function
    const { data: rpcData, error: rpcError } = await sbClient.rpc('get_growth_metrics');
    if (!rpcError && rpcData) {
      return rpcData;
    }
    console.warn("[Growth DB] RPC unavailable, falling back to direct table queries:", rpcError);
  } catch (e) {
    console.warn("[Growth DB] RPC fallback triggered");
  }

  // Fallback: Direct table aggregation in client
  try {
    const [eventsRes, ordersRes] = await Promise.all([
      sbClient.from('analytics_events').select('*').order('created_at', { ascending: false }).limit(2000),
      sbClient.from('orders').select('*')
    ]);

    const events = eventsRes.data || [];
    const orders = ordersRes.data || [];

    const sessionSet = new Set();
    const funnelMap = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set() };
    const buttonClickMap = {};
    const utmMap = {};
    const abMap = { A: { visitors: new Set(), buyers: new Set() }, B: { visitors: new Set(), buyers: new Set() } };

    events.forEach(ev => {
      sessionSet.add(ev.session_id);
      if (ev.funnel_step && funnelMap[ev.funnel_step]) {
        funnelMap[ev.funnel_step].add(ev.session_id);
      }
      if (ev.event_type === 'button_click' && ev.button_id) {
        if (!buttonClickMap[ev.button_id]) {
          buttonClickMap[ev.button_id] = { button_id: ev.button_id, button_text: ev.button_text || ev.button_id, click_count: 0 };
        }
        buttonClickMap[ev.button_id].click_count++;
      }
      const src = ev.utm_source || 'direct';
      if (!utmMap[src]) utmMap[src] = { source: src, visitors: new Set(), buyers: new Set() };
      utmMap[src].visitors.add(ev.session_id);
      if (ev.funnel_step === 5) utmMap[src].buyers.add(ev.session_id);

      const variant = ev.ab_variant === 'B' ? 'B' : 'A';
      abMap[variant].visitors.add(ev.session_id);
      if (ev.funnel_step === 5) abMap[variant].buyers.add(ev.session_id);
    });

    const funnel = [
      { step: 1, name: '1. 메인 랜딩 (Landing)', session_count: funnelMap[1].size },
      { step: 2, name: '2. 굿즈/티켓 둘러보기 (Explore)', session_count: funnelMap[2].size },
      { step: 3, name: '3. 주문서 작성 시작 (Checkout Start)', session_count: funnelMap[3].size },
      { step: 4, name: '4. 학생 인증 완료 (Verified)', session_count: funnelMap[4].size },
      { step: 5, name: '5. 구매/예약 완료 (Purchased)', session_count: funnelMap[5].size }
    ];

    const button_clicks = Object.values(buttonClickMap).sort((a, b) => b.click_count - a.click_count);
    const utm_sources = Object.values(utmMap).map(u => ({
      source: u.source,
      visitors: u.visitors.size,
      buyers: u.buyers.size
    })).sort((a, b) => b.visitors - a.visitors);

    const ab_test = [
      { variant: 'A', visitors: abMap.A.visitors.size, buyers: abMap.A.buyers.size },
      { variant: 'B', visitors: abMap.B.visitors.size, buyers: abMap.B.buyers.size }
    ];

    const total_revenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    const avg_order_value = orders.length > 0 ? Math.round(total_revenue / orders.length) : 0;

    return {
      total_sessions: sessionSet.size,
      funnel,
      button_clicks,
      utm_sources,
      ab_test,
      orders: {
        total_orders: orders.length,
        total_revenue,
        avg_order_value
      }
    };
  } catch (err) {
    console.error("[Growth DB] Metrics aggregation failed:", err);
    return null;
  }
}

/**
 * Fetch recent 25 live events for the real-time activity stream
 */
async function fetchRecentEventsStream(limit = 25) {
  if (!sbClient) return [];
  try {
    const { data, error } = await sbClient
      .from('analytics_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("[Growth DB] Fetch stream failed:", err);
    return [];
  }
}

/**
 * Insert synthetic traffic for realistic growth demonstration
 */
async function seedRealisticTraffic(count = 30) {
  if (!sbClient) return { success: false, message: "Supabase not connected" };

  const utmSources = [
    { src: 'everytime', weight: 45 },
    { src: 'instagram', weight: 30 },
    { src: 'campus_qr', weight: 15 },
    { src: 'kakaotalk', weight: 10 }
  ];
  const depts = ['컴퓨터공학과', '경영학과', '기계공학부', '화학공학과', '디자인학과', '의예과', '국어국문학과', '생명과학과'];
  const packages = [
    { type: 'BASIC', name: '일반 입장 & 야광봉 세트', price: 0 },
    { type: 'SPOOKY', name: '방탈출 우선권 + 산지니 키링 세트', price: 5900 },
    { type: 'VIP', name: '호러 VIP 프리패스 + 산지니 풀 패키지', price: 12900 }
  ];
  const buttons = [
    { id: 'btn-hero-reserve', text: '1차 얼리버드 한정 패키지 신청' },
    { id: 'btn-hero-timetable', text: '프로그램 타임테이블 보기' },
    { id: 'btn-pkg-basic', text: '일반 패키지 선택' },
    { id: 'btn-pkg-spooky', text: '스푸키 패키지 선택' },
    { id: 'btn-pkg-vip', text: '호러 VIP 패키지 선택' },
    { id: 'btn-vote-candidate-1', text: '컴공 404 좀비 투표' },
    { id: 'btn-vote-candidate-2', text: '산지니 사신 투표' },
    { id: 'btn-share-kakao', text: '카카오톡 친구 초대' },
    { id: 'btn-share-copy', text: '에브리타임 링크 복사' }
  ];

  function pickWeighted(arr) {
    const total = arr.reduce((acc, it) => acc + it.weight, 0);
    let r = Math.random() * total;
    for (const item of arr) {
      if (r < item.weight) return item.src;
      r -= item.weight;
    }
    return arr[0].src;
  }

  const generatedEvents = [];
  const generatedOrders = [];
  const generatedVotes = [];

  for (let i = 0; i < count; i++) {
    const fakeSessionId = 'sim_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    const source = pickWeighted(utmSources);
    const variant = Math.random() > 0.5 ? 'B' : 'A';
    const isMobile = Math.random() > 0.3;
    const deviceType = isMobile ? 'mobile' : 'desktop';

    // Step 1: Landing
    generatedEvents.push({
      session_id: fakeSessionId,
      event_type: 'funnel_step',
      event_name: 'landing_view',
      funnel_step: 1,
      utm_source: source,
      ab_variant: variant,
      device_type: deviceType,
      page_url: window.location.origin + window.location.pathname + `?utm_source=${source}`,
      metadata: { simulated: true }
    });

    // Random button clicks on landing
    const clickCount = Math.floor(Math.random() * 3) + 1;
    for (let c = 0; c < clickCount; c++) {
      const btn = buttons[Math.floor(Math.random() * buttons.length)];
      generatedEvents.push({
        session_id: fakeSessionId,
        event_type: 'button_click',
        event_name: 'click_' + btn.id,
        funnel_step: 1,
        button_id: btn.id,
        button_text: btn.text,
        utm_source: source,
        ab_variant: variant,
        device_type: deviceType,
        metadata: { simulated: true }
      });
    }

    // Step 2: Explore package (70% conversion from step 1)
    if (Math.random() < 0.72) {
      generatedEvents.push({
        session_id: fakeSessionId,
        event_type: 'funnel_step',
        event_name: 'package_explore',
        funnel_step: 2,
        utm_source: source,
        ab_variant: variant,
        device_type: deviceType,
        metadata: { simulated: true }
      });

      // Step 3: Checkout start (55% conversion from step 2)
      if (Math.random() < 0.58) {
        const pkg = packages[Math.floor(Math.random() * packages.length)];
        generatedEvents.push({
          session_id: fakeSessionId,
          event_type: 'funnel_step',
          event_name: 'checkout_start',
          funnel_step: 3,
          button_id: `btn-select-${pkg.type.toLowerCase()}`,
          button_text: `${pkg.name} 선택`,
          utm_source: source,
          ab_variant: variant,
          device_type: deviceType,
          metadata: { package_type: pkg.type, package_price: pkg.price, simulated: true }
        });

        // Step 4: Student verification (75% conversion from step 3)
        if (Math.random() < 0.75) {
          const studentNum = '202' + Math.floor(100000 + Math.random() * 899999);
          const dept = depts[Math.floor(Math.random() * depts.length)];
          generatedEvents.push({
            session_id: fakeSessionId,
            event_type: 'funnel_step',
            event_name: 'student_verify_complete',
            funnel_step: 4,
            utm_source: source,
            ab_variant: variant,
            device_type: deviceType,
            metadata: { student_id_prefix: studentNum.substring(0, 4), department: dept, simulated: true }
          });

          // Step 5: Purchase complete (80% conversion from step 4)
          if (Math.random() < 0.80) {
            generatedEvents.push({
              session_id: fakeSessionId,
              event_type: 'funnel_step',
              event_name: 'purchase_complete',
              funnel_step: 5,
              utm_source: source,
              ab_variant: variant,
              device_type: deviceType,
              metadata: { package_type: pkg.type, total_price: pkg.price, simulated: true }
            });

            // Add fake order
            generatedOrders.push({
              session_id: fakeSessionId,
              order_code: 'PNU-HW-' + Math.floor(100000 + Math.random() * 900000),
              student_id: studentNum,
              student_name: '효원이_' + Math.floor(Math.random() * 900 + 100),
              department: dept,
              phone: '010-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000),
              package_type: pkg.type,
              package_name: pkg.name,
              quantity: 1,
              unit_price: pkg.price,
              total_price: pkg.price,
              payment_method: pkg.price === 0 ? 'free_pass' : (Math.random() > 0.5 ? 'kakaopay' : 'tosspay'),
              status: 'completed',
              ab_variant: variant,
              utm_source: source,
              metadata: { simulated: true }
            });
          }
        }
      }
    }
  }

  try {
    if (generatedEvents.length > 0) {
      await sbClient.from('analytics_events').insert(generatedEvents);
    }
    if (generatedOrders.length > 0) {
      await sbClient.from('orders').insert(generatedOrders);
    }
    return { success: true, count: generatedEvents.length, orders: generatedOrders.length };
  } catch (err) {
    console.error("[Seeder] Error inserting traffic:", err);
    return { success: false, error: err.message };
  }
}

// Export to window for global access
window.GrowthDB = {
  client: sbClient,
  sendEvent: sendEventToSupabase,
  recordOrder: recordOrderToSupabase,
  submitVote: submitCostumeVoteToSupabase,
  fetchCostumeVotes,
  fetchMetrics: fetchGrowthMetricsFromDB,
  fetchRecentEvents: fetchRecentEventsStream,
  seedTraffic: seedRealisticTraffic
};
