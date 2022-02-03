export const wait = (time = 2000) => {
  console.debug(`=== start waiting (${time} ms) ===`);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      console.debug(`=== done waiting (${time} ms) ===`);
      resolve(null);
    }, time);
  });
};
