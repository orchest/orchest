const LENIENT_UUID_PATTERN = /^\w{8}\-\w{4}\-\w{4}\-\w{4}-\w{12}$/i;

export const isUuid = (input: string) => LENIENT_UUID_PATTERN.test(input);
