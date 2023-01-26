export default function classNames(...names: any[]) {
  return names.filter((n) => typeof n === "string").join(" ");
}
