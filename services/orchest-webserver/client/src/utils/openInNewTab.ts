export const openInNewTab = (url: string) => {
  if (typeof window === undefined) return;

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
};
