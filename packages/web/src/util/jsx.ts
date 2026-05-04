import { Fragment } from "react";
import type { ReactElement, ReactNode } from "react";
import { BOOLEAN, OVERLOADED_BOOLEAN, getPropertyInfo } from "react-property";

const HTML_NS = "http://www.w3.org/1999/xhtml";
const SVG_NS = "http://www.w3.org/2000/svg";

export function jsxToElement(node: ReactNode): HTMLElement {
  const el = jsxToNode(node);
  if (!(el instanceof HTMLElement)) throw new Error("Expected HTMLElement");
  return el;
}

export function jsxToSVGElement(node: ReactNode): SVGElement {
  const el = jsxToNode(node);
  if (!(el instanceof SVGElement)) throw new Error("Expected SVGElement");
  return el;
}

export function jsxToNode(node: ReactNode, ns = HTML_NS): Node {
  if (node == null || node === false) return document.createTextNode("");
  if (typeof node === "string" || typeof node === "number")
    return document.createTextNode(String(node));

  const { type, props } = node as ReactElement<{
    [key: string]: unknown;
    children?: ReactNode | ReactNode[];
  }>;
  if (type === Fragment) {
    const frag = document.createDocumentFragment();
    for (const child of [props.children].flat())
      frag.appendChild(jsxToNode(child, ns));
    return frag;
  }

  if (typeof type !== "string")
    throw new Error(`Unsupported node type: ${String(type)}`);

  const elNs = type === "svg" ? SVG_NS : ns;
  const childNs = type === "foreignObject" ? HTML_NS : elNs;
  const el = document.createElementNS(elNs, type) as HTMLElement | SVGElement;

  for (const [k, v] of Object.entries(props)) {
    if (k === "children") continue;
    if (k === "style" && typeof v === "object" && v !== null) {
      for (const [prop, val] of Object.entries(v))
        el.style.setProperty(
          prop.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`),
          String(val),
        );
    } else {
      const info = getPropertyInfo(k);
      if (info) {
        if (info.mustUseProperty) {
          (el as unknown as Record<string, unknown>)[info.propertyName] = v;
        } else if (info.type === BOOLEAN || info.type === OVERLOADED_BOOLEAN) {
          if (v) el.setAttribute(info.attributeName, "");
          else el.removeAttribute(info.attributeName);
        } else {
          el.setAttribute(info.attributeName, String(v));
        }
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }

  for (const child of [props.children].flat()) {
    const childNode = jsxToNode(child, childNs);
    if (childNode.nodeType !== Node.TEXT_NODE || childNode.textContent !== "")
      el.appendChild(childNode);
  }

  return el;
}
