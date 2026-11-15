/* ===========================================================
 * 摸鱼补给站 · Web Audio 合成音效（零素材、零依赖）
 * 全部声音由算法实时生成，不加载任何音频文件
 * =========================================================== */
(function (root) {
  'use strict';

  var ctx = null;
  var master = null;
  var volume = 0.5;
  var current = null;          // { id, nodes:[], timers:[], gain:AudioNode }
  var currentId = '';

  function Ctor() {
    return root.AudioContext || root.webkitAudioContext || null;
  }

  function supported() {
    return !!Ctor();
  }

  function ensure() {
    if (!Ctor()) return null;
    if (!ctx) {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) { /* 忽略 */ } }
    return ctx;
  }

  /* ---------- 基础素材 ---------- */

  function noiseBuffer(c, seconds, kind) {
    var len = Math.floor(c.sampleRate * seconds);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    var i, w, last = 0;
    if (kind === 'brown') {
      for (i = 0; i < len; i++) {
        w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    } else if (kind === 'pink') {
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (i = 0; i < len; i++) {
        w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      for (i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function noiseSource(c, kind, seconds) {
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(c, seconds || 4, kind || 'white');
    src.loop = true;
    return src;
  }

  function filter(c, type, freq, q) {
    var f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q) f.Q.value = q;
    return f;
  }

  function gainNode(c, v) {
    var g = c.createGain();
    g.gain.value = v;
    return g;
  }

  function lfo(c, rate, depth, target, base) {
    var osc = c.createOscillator();
    osc.frequency.value = rate;
    var amp = gainNode(c, depth);
    osc.connect(amp);
    amp.connect(target);
    osc.start();
    if (base !== undefined) target.value = base;
    return osc;
  }

  /* ---------- 六种环境音 ---------- */

  var VOICES = {
    /* 雨声：宽带噪声 + 轻微起伏 */
    rain: function (c) {
      var src = noiseSource(c, 'white', 4);
      var bp = filter(c, 'bandpass', 1350, 0.55);
      var g = gainNode(c, 0.26);
      var hp = filter(c, 'highpass', 3000, 0.7);
      var hg = gainNode(c, 0.05);
      src.connect(bp); bp.connect(g); g.connect(master);
      src.connect(hp); hp.connect(hg); hg.connect(master);
      lfo(c, 0.09, 0.06, g.gain, 0.26);
      src.start();
      return { nodes: [src] };
    },

    /* 咖啡馆：低频嘈杂 + 偶发杯盏轻响 */
    cafe: function (c) {
      var src = noiseSource(c, 'brown', 5);
      var lp = filter(c, 'lowpass', 760, 0.6);
      var g = gainNode(c, 0.3);
      src.connect(lp); lp.connect(g); g.connect(master);
      src.start();
      var timers = [];
      (function clink() {
        var t = setTimeout(function () {
          if (!current || current.id !== 'cafe') return;
          var o = c.createOscillator();
          var og = gainNode(c, 0.0001);
          o.type = 'sine';
          o.frequency.value = 1500 + Math.random() * 1400;
          og.gain.setValueAtTime(0.0001, c.currentTime);
          og.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.01);
          og.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5);
          o.connect(og); og.connect(master);
          o.start(); o.stop(c.currentTime + 0.55);
          clink();
        }, 1400 + Math.random() * 3200);
        timers.push(t);
      })();
      return { nodes: [src], timers: timers };
    },

    /* 地铁：低沉轰鸣 + 车厢晃动 */
    subway: function (c) {
      var src = noiseSource(c, 'brown', 6);
      var lp = filter(c, 'lowpass', 340, 0.8);
      var g = gainNode(c, 0.34);
      src.connect(lp); lp.connect(g); g.connect(master);
      var rum = c.createOscillator();
      rum.type = 'sawtooth';
      rum.frequency.value = 46;
      var rlp = filter(c, 'lowpass', 140, 1);
      var rg = gainNode(c, 0.06);
      rum.connect(rlp); rlp.connect(rg); rg.connect(master);
      rum.start();
      lfo(c, 0.13, 18, rum.frequency, 46);
      src.start();
      return { nodes: [src, rum] };
    },

    /* 空调：均匀风声 + 微弱电流声 */
    aircon: function (c) {
      var src = noiseSource(c, 'white', 4);
      var lp = filter(c, 'lowpass', 520, 0.7);
      var g = gainNode(c, 0.22);
      src.connect(lp); lp.connect(g); g.connect(master);
      var hum = c.createOscillator();
      hum.type = 'sine'; hum.frequency.value = 118;
      var hg = gainNode(c, 0.028);
      hum.connect(hg); hg.connect(master);
      var hum2 = c.createOscillator();
      hum2.type = 'sine'; hum2.frequency.value = 236;
      var hg2 = gainNode(c, 0.01);
      hum2.connect(hg2); hg2.connect(master);
      hum.start(); hum2.start();
      return { nodes: [src, hum, hum2] };
    },

    /* 海浪：缓慢起伏的宽频噪声 */
    waves: function (c) {
      var src = noiseSource(c, 'white', 6);
      var bp = filter(c, 'bandpass', 760, 0.5);
      var g = gainNode(c, 0.22);
      src.connect(bp); bp.connect(g); g.connect(master);
      lfo(c, 0.075, 0.16, g.gain, 0.22);
      var src2 = noiseSource(c, 'pink', 6);
      var lp2 = filter(c, 'lowpass', 900, 0.5);
      var g2 = gainNode(c, 0.1);
      src2.connect(lp2); lp2.connect(g2); g2.connect(master);
      lfo(c, 0.11, 0.07, g2.gain, 0.1);
      src.start(); src2.start();
      return { nodes: [src, src2] };
    },

    /* 翻书：安静的底噪 + 偶尔的翻页声 */
    pages: function (c) {
      var src = noiseSource(c, 'pink', 4);
      var lp = filter(c, 'lowpass', 320, 0.6);
      var g = gainNode(c, 0.08);
      src.connect(lp); lp.connect(g); g.connect(master);
      src.start();
      var timers = [];
      (function turn() {
        var t = setTimeout(function () {
          if (!current || current.id !== 'pages') return;
          var n = c.createBufferSource();
          n.buffer = noiseBuffer(c, 0.4, 'white');
          var bp = filter(c, 'bandpass', 2400, 0.9);
          var ng = gainNode(c, 0.0001);
          ng.gain.setValueAtTime(0.0001, c.currentTime);
          ng.gain.exponentialRampToValueAtTime(0.14, c.currentTime + 0.03);
          ng.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.38);
          n.connect(bp); bp.connect(ng); ng.connect(master);
          n.start(); n.stop(c.currentTime + 0.45);
          turn();
        }, 5200 + Math.random() * 4200);
        timers.push(t);
      })();
      return { nodes: [src], timers: timers };
    }
  };

  var LIST = [
    { id: 'rain', name: '窗外在下雨', emoji: '🌧️', desc: '适合假装在思考人生' },
    { id: 'cafe', name: '安静的咖啡馆', emoji: '☕', desc: '适合假装在开会' },
    { id: 'subway', name: '末班地铁', emoji: '🚇', desc: '适合假装在通勤' },
    { id: 'aircon', name: '办公室的空调', emoji: '❄️', desc: '适合假装在加班' },
    { id: 'waves', name: '海边的浪', emoji: '🌊', desc: '适合假装在度假' },
    { id: 'pages', name: '翻书的声音', emoji: '📖', desc: '适合假装在学习' }
  ];

  /* ---------- 控制 ---------- */

  function stop(fade) {
    if (!current) return;
    var c = ctx;
    var v = current;
    current = null;
    currentId = '';
    (v.timers || []).forEach(function (t) { clearTimeout(t); });
    if (!c) return;
    var t0 = c.currentTime;
    var dur = fade === false ? 0 : 0.45;
    if (v.gain) {
      try {
        v.gain.gain.cancelScheduledValues(t0);
        v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), t0);
        v.gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      } catch (e) { /* 忽略 */ }
    }
    (v.nodes || []).forEach(function (n) {
      try { n.stop(t0 + dur + 0.05); } catch (e) { /* 忽略 */ }
    });
  }

  function play(id) {
    if (!VOICES[id]) return false;
    if (!ensure()) return false;
    if (currentId === id) { stop(); return true; }
    stop();
    var c = ctx;
    var voice = VOICES[id](c);
    current = { id: id, nodes: voice.nodes || [], timers: voice.timers || [] };
    currentId = id;
    return true;
  }

  function toggle(id) {
    if (currentId === id) { stop(); return false; }
    return play(id);
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (master && ctx) {
      try { master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05); } catch (e) { /* 忽略 */ }
    }
    return volume;
  }

  function getVolume() { return volume; }

  /* 番茄钟结束的提示音 */
  function chime() {
    var c = ensure();
    if (!c) return false;
    var notes = [523.25, 659.25, 783.99];
    notes.forEach(function (f, i) {
      var o = c.createOscillator();
      var g = gainNode(c, 0.0001);
      o.type = 'sine';
      o.frequency.value = f;
      var t0 = c.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 1.2);
    });
    return true;
  }

  root.HS_AUDIO = {
    sounds: LIST,
    supported: supported,
    play: play,
    stop: stop,
    toggle: toggle,
    setVolume: setVolume,
    getVolume: getVolume,
    chime: chime,
    currentId: function () { return currentId; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.HS_AUDIO;
})(typeof window !== 'undefined' ? window : globalThis);
