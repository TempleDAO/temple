export const formatNumber = (number: number) => {
  const stringified = number.toString();
  const decimalPlaces = stringified.includes('.')
    ? stringified.split('.')[1].length
    : 0;

  return decimalPlaces > 3
    ? number.toLocaleString('en-US', {
        minimumFractionDigits: 4,
      })
    : number.toLocaleString('en-US');
};