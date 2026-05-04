import { describe, expect, it } from "vitest";

import { jsxToElement, jsxToNode, jsxToSVGElement } from "./jsx";

const SVG_NS = "http://www.w3.org/2000/svg";
const HTML_NS = "http://www.w3.org/1999/xhtml";

describe("jsxToElement", () => {
  it("creates an html element", () => {
    const el = jsxToElement(<div />);
    expect(el.tagName).toBe("DIV");
    expect(el.namespaceURI).toBe(HTML_NS);
  });

  it("sets attributes", () => {
    const el = jsxToElement(<div id="foo" className="bar" />);
    expect(el.getAttribute("id")).toBe("foo");
  });

  it("sets property when it exists on element", () => {
    const el = jsxToElement(<input type="checkbox" />) as HTMLInputElement;
    expect(el.type).toBe("checkbox");
  });

  it("appends text children", () => {
    const el = jsxToElement(<div>hello</div>);
    expect(el.textContent).toBe("hello");
  });

  it("appends element children", () => {
    const el = jsxToElement(
      <div>
        <span />
        <span />
      </div>,
    ) as Element;
    expect(el.children).toHaveLength(2);
  });

  it("handles null children", () => {
    const el = jsxToElement(<div>{null}</div>);
    expect(el.childNodes).toHaveLength(0);
  });

  it("handles false children", () => {
    const el = jsxToElement(<div>{false}</div>);
    expect(el.childNodes).toHaveLength(0);
  });

  it("handles number children", () => {
    const el = jsxToElement(<div>{42}</div>);
    expect(el.textContent).toBe("42");
  });

  it("creates svg elements with svg namespace", () => {
    const el = jsxToSVGElement(
      <svg>
        <path d="M0 0" />
      </svg>,
    );
    expect(el.namespaceURI).toBe(SVG_NS);
    expect(el.firstElementChild!.namespaceURI).toBe(SVG_NS);
  });

  it("switches to svg namespace at svg tag inside html", () => {
    const el = jsxToElement(
      <div>
        <svg />
      </div>,
    ) as Element;
    expect(el.namespaceURI).toBe(HTML_NS);
    expect(el.firstElementChild!.namespaceURI).toBe(SVG_NS);
  });

  it("handles fragments", () => {
    const frag = jsxToNode(
      <>
        <span />
        <span />
      </>,
    ) as DocumentFragment;
    expect(frag.childNodes).toHaveLength(2);
  });

  it("maps className to class attribute", () => {
    const el = jsxToElement(<div className="foo" />) as Element;
    expect(el.getAttribute("class")).toBe("foo");
  });

  it("sets boolean attribute when true", () => {
    const el = jsxToElement(<input disabled />) as Element;
    expect(el.hasAttribute("disabled")).toBe(true);
  });

  it("removes boolean attribute when false", () => {
    const el = jsxToElement(<input disabled={false} />) as Element;
    expect(el.hasAttribute("disabled")).toBe(false);
  });

  it("sets mustUseProperty via property not attribute", () => {
    const el = jsxToElement(<input checked />) as HTMLInputElement;
    expect(el.checked).toBe(true);
  });

  it("sets style properties from object", () => {
    const el = jsxToElement(
      <div style={{ overflow: "visible", pointerEvents: "none" }} />,
    ) as HTMLElement;
    expect(el.style.overflow).toBe("visible");
    expect(el.style.pointerEvents).toBe("none");
  });

  it("sets style properties from object on svg", () => {
    const el = jsxToSVGElement(
      <svg style={{ pointerEvents: "none" }}>
        <rect style={{ fillOpacity: 0.5 }} />
      </svg>,
    );
    expect(el.style.pointerEvents).toBe("none");
    expect((el.firstChild! as SVGElement).style.fillOpacity).toBe("0.5");
  });

  it("foreignObject children get html namespace", () => {
    const el = jsxToSVGElement(
      <svg>
        <foreignObject>
          <div />
        </foreignObject>
      </svg>,
    );
    const fo = el.firstElementChild!;
    expect(fo.namespaceURI).toBe(SVG_NS);
    expect(fo.firstElementChild!.namespaceURI).toBe(HTML_NS);
  });

  it("throws on component types", () => {
    const Comp = () => <div />;
    expect(() => jsxToSVGElement(<Comp />)).toThrow("Unsupported node type");
  });
});
