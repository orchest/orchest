export const paginate = <T>(input: T[], page: number, pageSize = 10) => ({
  pageCount: Math.ceil(input.length / pageSize),
  items: input.slice((page - 1) * pageSize, page * pageSize),
});
