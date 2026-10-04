import { CHAPTERS } from '../data/content.js';
import { save } from '../data/save.js';

/** Draws a 1080×1350 social card for the run — the viral loop's centrepiece. */
export async function makeCard(run) {
  await document.fonts?.ready;
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  const night = run.chapter >= 3 && run.chapter <= 4;
  const sky = g.createLinearGradient(0, 0, 0, H);
  if (night) {
    sky.addColorStop(0, '#070b26');
    sky.addColorStop(0.55, '#2a2f6e');
    sky.addColorStop(0.8, '#5a3a6a');
  } else {
    sky.addColorStop(0, '#3b2a6e');
    sky.addColorStop(0.42, '#ff7a2f');
    sky.addColorStop(0.72, '#ffc940');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (night) {
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 160; i++) g.fillRect(Math.random() * W, Math.random() * H * 0.6, 2.5, 2.5);
  }

  // sun / moon
  const sx = W * 0.5;
  const sy = H * 0.76;
  const glow = g.createRadialGradient(sx, sy, 40, sx, sy, 420);
  glow.addColorStop(0, night ? 'rgba(200,210,255,0.6)' : 'rgba(255,240,180,0.9)');
  glow.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.fillStyle = night ? '#e8ecff' : '#fff1c4';
  g.beginPath();
  g.arc(sx, sy, 150, 0, Math.PI * 2);
  g.fill();

  // savanna silhouette
  g.fillStyle = '#2b1a0e';
  g.beginPath();
  g.moveTo(0, H * 0.78);
  g.quadraticCurveTo(W * 0.25, H * 0.74, W * 0.5, H * 0.775);
  g.quadraticCurveTo(W * 0.75, H * 0.8, W, H * 0.76);
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.fill();
  acacia(g, W * 0.86, H * 0.768, 0.95);
  acacia(g, W * 0.1, H * 0.778, 0.6);
  giraffe(g, W * 0.24, H * 0.778, 0.95);
  // Fisi's eyes lurking
  g.fillStyle = '#ffe14d';
  g.shadowColor = '#ffd000';
  g.shadowBlur = 20;
  for (const [x, y] of [[W * 0.66, H * 0.835], [W * 0.75, H * 0.85]]) {
    g.beginPath();
    g.ellipse(x, y, 13, 7, 0, 0, Math.PI * 2);
    g.ellipse(x + 34, y, 13, 7, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;

  // logo
  g.textAlign = 'center';
  g.font = '150px "Lilita One", sans-serif';
  g.save();
  g.translate(W / 2, 220);
  g.rotate(-0.05);
  g.fillStyle = '#2b1a0e';
  g.fillText('KIMBIA!', 0, 10);
  const lg = g.createLinearGradient(0, -120, 0, 10);
  lg.addColorStop(0, '#fff6c8');
  lg.addColorStop(0.5, '#ffc940');
  lg.addColorStop(1, '#ff7a2f');
  g.fillStyle = lg;
  g.fillText('KIMBIA!', 0, 0);
  g.restore();
  g.font = '38px "Lilita One", sans-serif';
  g.fillStyle = '#fff4de';
  g.fillText('SPIRIT OF THE SERENGETI', W / 2, 290);

  // score plate
  roundRect(g, 110, 360, W - 220, 400, 48);
  g.fillStyle = 'rgba(43,26,14,0.78)';
  g.fill();
  g.font = '800 40px Nunito, sans-serif';
  g.fillStyle = '#ffe08a';
  g.fillText(run.caught ? 'I OUTRAN FISI FOR' : 'I RAN', W / 2, 440);
  g.font = '170px "Lilita One", sans-serif';
  g.fillStyle = '#ffffff';
  g.fillText(`${run.distance.toLocaleString()}m`, W / 2, 610);
  g.font = '800 44px Nunito, sans-serif';
  g.fillStyle = '#ffc940';
  g.fillText(`★ ${run.score.toLocaleString()} points  ·  ${run.seeds} seeds`, W / 2, 690);
  const ch = CHAPTERS[Math.max(0, run.chapter)];
  g.font = '800 32px Nunito, sans-serif';
  g.fillStyle = 'rgba(255,244,222,0.8)';
  g.fillText(`Chapter ${run.chapter + 1}: ${ch.title}`, W / 2, 740);

  // call to action
  g.font = '72px "Lilita One", sans-serif';
  g.fillStyle = '#ffc940';
  g.fillText('Can you beat me?', W / 2, H - 140);
  g.font = '800 34px Nunito, sans-serif';
  g.fillStyle = 'rgba(255,244,222,0.85)';
  g.fillText(`Play free ▸ ${location.host || 'kimbia.game'}`, W / 2, H - 70);

  return new Promise((r) => c.toBlob(r, 'image/png'));
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function acacia(g, x, y, s) {
  g.fillStyle = '#2b1a0e';
  g.fillRect(x - 6 * s, y - 150 * s, 12 * s, 150 * s);
  g.beginPath();
  g.ellipse(x, y - 160 * s, 120 * s, 24 * s, 0, 0, Math.PI * 2);
  g.ellipse(x - 50 * s, y - 175 * s, 70 * s, 18 * s, 0, 0, Math.PI * 2);
  g.ellipse(x + 50 * s, y - 172 * s, 70 * s, 18 * s, 0, 0, Math.PI * 2);
  g.fill();
}

function giraffe(g, x, y, s) {
  g.fillStyle = '#2b1a0e';
  g.beginPath();
  g.ellipse(x, y - 110 * s, 50 * s, 26 * s, 0, 0, Math.PI * 2);
  g.fill();
  for (const dx of [-36, -24, 26, 38]) g.fillRect(x + dx * s, y - 110 * s, 7 * s, 110 * s);
  g.save();
  g.translate(x + 38 * s, y - 120 * s);
  g.rotate(-0.45);
  g.fillRect(-8 * s, -110 * s, 16 * s, 110 * s);
  g.beginPath();
  g.ellipse(10 * s, -112 * s, 22 * s, 11 * s, 0.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function challengeUrl(run) {
  const u = new URL(location.origin + '/');
  u.searchParams.set('c', run.score);
  if (save.name) u.searchParams.set('n', save.name.slice(0, 16));
  return u.toString();
}

/** Web Share with image when supported; falls back to text share, then download+copy. */
export async function shareRun(run) {
  const url = challengeUrl(run);
  const text = `I ran ${run.distance.toLocaleString()}m and scored ${run.score.toLocaleString()} in KIMBIA! 🦁🐘🦒 Can you outrun Fisi the hyena king?`;
  let blob;
  try {
    blob = await makeCard(run);
  } catch {
    /* ignore — share text only */
  }
  const file = blob && new File([blob], 'kimbia-score.png', { type: 'image/png' });
  try {
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: `${text} ${url}`, title: 'KIMBIA!' });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ text, url, title: 'KIMBIA!' });
      return 'shared';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
  }
  // desktop fallback: download the card and copy the challenge link
  if (blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kimbia-score.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch {
    return 'downloaded';
  }
}
