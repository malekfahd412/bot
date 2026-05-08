import { createCanvas } from '@napi-rs/canvas';
import { Difficulty } from '../utils/constants.js';

export async function generateMissionCard(
  heistName: string,
  difficulty: Difficulty,
  submitter: string,
  teammates: string[],
  xp: number,
  coins: number,
  approved: boolean
): Promise<Buffer> {

  const canvas = createCanvas(1400, 800);
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, 1400, 800);
  bg.addColorStop(0, '#090B10');
  bg.addColorStop(1, '#111827');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Glow
  ctx.fillStyle = approved
    ? 'rgba(0,255,140,0.12)'
    : 'rgba(255,50,50,0.12)';

  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top line
  ctx.fillStyle = approved ? '#00ff88' : '#ff3b3b';
  ctx.fillRect(0, 0, 1400, 8);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px Arial';
  ctx.fillText(
    approved ? 'MISSION APPROVED' : 'MISSION REJECTED',
    60,
    90
  );

  // Heist name
  ctx.fillStyle = '#d1d5db';
  ctx.font = 'bold 38px Arial';
  ctx.fillText(heistName.toUpperCase(), 60, 160);

  // Difficulty
  const diffColor =
    difficulty === 'easy'
      ? '#00ff88'
      : difficulty === 'normal'
      ? '#ffd000'
      : '#ff3b3b';

  ctx.fillStyle = diffColor;
  ctx.roundRect(60, 200, 220, 60, 16);
  ctx.fill();

  ctx.fillStyle = '#000';
  ctx.font = 'bold 28px Arial';
  ctx.fillText(difficulty.toUpperCase(), 100, 240);

  // Crew panel
  ctx.fillStyle = '#121826';
  ctx.roundRect(60, 310, 550, 360, 20);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px Arial';
  ctx.fillText('CREW MEMBERS', 90, 360);

  ctx.font = '26px Arial';

  let y = 420;

  const allCrew = [submitter, ...teammates];

  allCrew.forEach((member, index) => {
    ctx.fillStyle = index === 0 ? '#00d9ff' : '#ffffff';

    const cleanName = member
      .replace(/[<@!>]/g, '')
      .replace(/\s+/g, '');

    ctx.fillText(`◆ PLAYER ${index + 1}: ${cleanName}`, 90, y);

    y += 50;
  });

  // Rewards panel
  ctx.fillStyle = '#121826';
  ctx.roundRect(760, 310, 560, 260, 20);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px Arial';
  ctx.fillText('MISSION REWARDS', 800, 370);

  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 40px Arial';
  ctx.fillText(`+${xp} XP`, 820, 450);

  ctx.fillStyle = '#FFD700';
  ctx.fillText(`$${coins.toLocaleString()}`, 820, 520);

  // GTA badge
  ctx.fillStyle = '#C8A951';
  ctx.beginPath();
  ctx.arc(1180, 120, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000';
  ctx.font = 'bold 30px Arial';
  ctx.fillText('GTA', 1145, 130);

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 760, 1400, 40);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '20px Arial';
  ctx.fillText(
    'LOS SANTOS HEIST NETWORK • SECURED TRANSMISSION',
    50,
    786
  );

  return canvas.toBuffer('image/png');
}
