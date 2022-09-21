export const getCurrentDateTimeString = () => toUtcDateTimeString(new Date());
export const toUtcDateTimeString = (dateTime: Date) => {
  // API accept UTC time but not in ISO date format (i.e. T and Z should be removed).
  return dateTime.toISOString().replace("T", " ").replace("Z", "");
};
export const convertUtcToLocalDate = (utcString: string) =>
  new Date(
    new Date(utcString).getTime() - new Date().getTimezoneOffset() * 60000
  );
