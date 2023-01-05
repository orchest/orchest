export const paginate = <T>(input: T[], page: number, pageSize = 10) => ({
  pageCount: Math.ceil(input.length / pageSize),
  items: input.slice((page - 1) * pageSize, page * pageSize),
});

export const sequenceEquals = <T>(left: T[] | undefined, right: T[]) => {
  if (left === right) return true;
  if (left?.length !== right.length) return false;

  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }

  return true;
};
