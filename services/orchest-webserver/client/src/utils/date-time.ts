export const getCurrentDateTimeString = () => toUtcDateTimeString(new Date());
export const toValidDateString = (dateString: string) => {
  // 2011-06-21 14:27:28.593 => 2011-06-21T14:27:28.593
  return dateString.trim().replace(" ", "T");
};
export const toUtcDateTimeString = (dateTime: Date) => {
  // API accept UTC time but not in ISO date format (i.e. T and Z should be removed).
  return dateTime.toISOString().replace("T", " ").replace("Z", "");
};
export const convertUtcToLocalDate = (utcString: string) => {
  const validUtcString = toValidDateString(utcString);
  return new Date(
    new Date(validUtcString).getTime() - new Date().getTimezoneOffset() * 60000
  );
};
