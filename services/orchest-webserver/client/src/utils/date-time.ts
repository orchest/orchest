export const getCurrentDateTimeString = () =>
  convertDateToDateTimeString(new Date(new Date().getTime() + 60000));
export const convertDateToDateTimeString = (dateTime: Date) => {
  let dateTimeString = dateTime.toISOString();

  // API doesn't accept ISO date strings with 'Z' suffix
  // Instead, endpoint assumes its passed a UTC dateTime string.
  if (dateTimeString[dateTimeString.length - 1] === "Z") {
    dateTimeString = dateTimeString.slice(0, dateTimeString.length - 1);
  }
  return dateTimeString;
};
