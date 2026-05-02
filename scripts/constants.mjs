export const SIGNAL_LEVELS = ['低', '中', '中高', '高'];

export function isSignalLevel(value) {
  return SIGNAL_LEVELS.includes(value);
}

export function normalizeSignalLevel(value, fallback = '低') {
  return isSignalLevel(value) ? value : fallback;
}

export const NAYIN_WUXING = {
  '海中金': '金',
  '炉中火': '火',
  '大林木': '木',
  '路旁土': '土',
  '剑锋金': '金',
  '山头火': '火',
  '涧下水': '水',
  '城头土': '土',
  '白蜡金': '金',
  '杨柳木': '木',
  '泉中水': '水',
  '屋上土': '土',
  '霹雳火': '火',
  '松柏木': '木',
  '长流水': '水',
  '沙中金': '金',
  '山下火': '火',
  '平地木': '木',
  '壁上土': '土',
  '金箔金': '金',
  '覆灯火': '火',
  '佛灯火': '火',
  '天河水': '水',
  '大驿土': '土',
  '钗钏金': '金',
  '桑柘木': '木',
  '大溪水': '水',
  '沙中土': '土',
  '天上火': '火',
  '石榴木': '木',
  '大海水': '水'
};

export function nayinElement(nayin) {
  return NAYIN_WUXING[nayin] || '';
}

export const PILLAR_KEYS = ['year', 'month', 'day', 'time'];
