// Format large numbers like social media platforms
// 464 → 464, 4543 → 4,543, 10500 → 10.5K, 487000 → 487K, 2000000 → 2M
export const formatCount = (count: number): string => {
  if (count < 1000) {
    return count.toString();
  }
  
  if (count < 10000) {
    return count.toLocaleString();
  }
  
  if (count < 1000000) {
    const k = count / 1000;
    if (k >= 100) {
      return `${Math.floor(k)}K`;
    }
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  
  const m = count / 1000000;
  return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
};
