/**
 * ---------------------------------------------------------
 * JaDyDoCo – JavaScript Dynamic DOM Constructor
 * ---------------------------------------------------------
 *
 * Version:
 * 2.0.0-alpha
 *
 * Author:
 * Thomas Badrow
 *
 * Original Development:
 * 2016 / 2017
 *
 * Modernized ES6 Rewrite:
 * 2026
 *
 * Description:
 * JaDyDoCo is a lightweight declarative UI rendering library
 * for dynamically generating DOM structures from JavaScript
 * object maps.
 *
 * The framework follows a recursive rendering approach:
 *
 * Map Object
 * → createElement()
 * → recursive render()
 * → DOM Output
 *
 * Features:
 * - Recursive DOM rendering
 * - Declarative UI maps
 * - Dynamic attributes
 * - Event binding
 * - Dataset support
 * - Inline style support
 * - Async remote rendering
 * - JSON/API template rendering
 * - Lightweight architecture
 * - No Virtual DOM
 * - No dependencies
 *
 * Philosophy:
 * JaDyDoCo focuses on simplicity and direct DOM generation
 * instead of abstraction-heavy rendering layers.
 *
 * Example:
 *
 * app.render({
 *   tagName: "section",
 *   class: "hero",
 *   children: [
 *     {
 *       tagName: "h1",
 *       text: "Hello JaDyDoCo"
 *     }
 *   ]
 * });
 *
 * ---------------------------------------------------------
 * NODE STRUCTURE
 * ---------------------------------------------------------
 *
 * {
 *   tagName: "div",
 *   attrs: {},
 *   class: "",
 *   text: "",
 *   html: "",
 *   dataset: {},
 *   style: {},
 *   events: {},
 *   children: []
 * }
 *
 * ---------------------------------------------------------
 * RESERVED KEYS
 * ---------------------------------------------------------
 *
 * tagName
 * children
 * text
 * html
 * events
 * attrs
 * dataset
 * style
 * pieces
 * options
 * data
 * template
 *
 * ---------------------------------------------------------
 * LICENSE
 * ---------------------------------------------------------
 *
 * MIT License
 *
 * ---------------------------------------------------------
 */

// @ts-nocheck -- Runtime implementation is intentionally dynamic; public JSDoc
// types are verified independently in test-d/JaDyDoCo.types.js.

/**
 * A value accepted for ordinary HTML attributes.
 * `true` creates a boolean attribute; false and nullish values are omitted.
 *
 * @typedef {string | number | boolean | null | undefined} AttributeValue
 */

/**
 * CSS classes can be passed as one string or as an array. Falsy array entries
 * are ignored, which makes conditional classes convenient.
 *
 * @typedef {string | Array<string | false | null | undefined>} ClassValue
 */

/** @typedef {Record<string, AttributeValue>} AttributeMap */
/** @typedef {Record<string, string | number | boolean | null | undefined>} DatasetMap */
/** @typedef {Partial<CSSStyleDeclaration> & Record<string, string | number | null | undefined>} StyleMap */
/** @typedef {Record<string, EventListener>} EventMap */

/**
 * Fields shared by every declarative node.
 *
 * @typedef {Object} NodeFields
 * @property {AttributeMap} [attrs] Additional HTML attributes.
 * @property {string} [id] Unique element identifier.
 * @property {string} [title] Advisory element title.
 * @property {string} [role] Accessibility role.
 * @property {number} [tabindex] Keyboard tab order.
 * @property {boolean} [hidden] Whether the element is hidden.
 * @property {ClassValue} [class] One or more CSS classes.
 * @property {string | number | boolean} [text] Safe text rendered with textContent.
 * @property {string} [html] Trusted HTML rendered with innerHTML.
 * @property {DatasetMap} [dataset] Values exposed as data-* attributes.
 * @property {StyleMap} [style] Inline styles using DOM style property names.
 * @property {EventMap} [events] Native event names mapped to listener functions.
 * @property {JaDyNode[]} [children] Nested declarative nodes.
 */

/**
 * A hyperlink. JaDyDoCo's typed convenience model requires a destination;
 * use a GenericNode when deliberately creating an anchor without href.
 *
 * @typedef {NodeFields & {
 *   tagName: "a",
 *   href: string,
 *   target?: "_self" | "_blank" | "_parent" | "_top" | string,
 *   rel?: string,
 *   download?: boolean | string,
 *   hreflang?: string,
 *   type?: string
 * }} AnchorNode
 */

/**
 * An image. `alt` is intentionally required, but may be an empty string for a
 * decorative image.
 *
 * @typedef {NodeFields & {
 *   tagName: "img",
 *   src: string,
 *   alt: string,
 *   width?: number | string,
 *   height?: number | string,
 *   loading?: "eager" | "lazy",
 *   decoding?: "sync" | "async" | "auto",
 *   srcset?: string,
 *   sizes?: string
 * }} ImageNode
 */

/**
 * @typedef {NodeFields & {
 *   tagName: "button",
 *   type: "button" | "submit" | "reset",
 *   name?: string,
 *   value?: string | number,
 *   disabled?: boolean,
 *   form?: string
 * }} ButtonNode
 */

/**
 * @typedef {NodeFields & {
 *   tagName: "input",
 *   type: string,
 *   name?: string,
 *   value?: string | number,
 *   placeholder?: string,
 *   checked?: boolean,
 *   disabled?: boolean,
 *   required?: boolean,
 *   readonly?: boolean,
 *   min?: string | number,
 *   max?: string | number,
 *   step?: string | number,
 *   autocomplete?: string
 * }} InputNode
 */

/**
 * @typedef {Object} SelectOption
 * @property {string | number} [value]
 * @property {string | number} [text]
 * @property {boolean} [selected]
 * @property {boolean} [disabled]
 */

/**
 * @typedef {NodeFields & {
 *   tagName: "select",
 *   name?: string,
 *   disabled?: boolean,
 *   required?: boolean,
 *   multiple?: boolean,
 *   options?: SelectOption[]
 * }} SelectNode
 */

/**
 * @typedef {NodeFields & {
 *   tagName: "textarea",
 *   name?: string,
 *   placeholder?: string,
 *   rows?: number,
 *   cols?: number,
 *   disabled?: boolean,
 *   required?: boolean,
 *   readonly?: boolean
 * }} TextareaNode
 */

/**
 * @typedef {NodeFields & {
 *   tagName: "form",
 *   action?: string,
 *   method?: "get" | "post" | "dialog",
 *   enctype?: string,
 *   novalidate?: boolean,
 *   target?: string
 * }} FormNode
 */

/**
 * @typedef {NodeFields & {
 *   tagName: "label",
 *   for?: string
 * }} LabelNode
 */

/**
 * Common container and text elements. Element-specific values not listed here
 * can always be placed explicitly in `attrs`.
 *
 * @typedef {NodeFields & {
 *   tagName: "address" | "article" | "aside" | "blockquote" | "div" |
 *     "footer" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "header" |
 *     "li" | "main" | "nav" | "ol" | "p" | "pre" | "section" | "span" |
 *     "strong" | "em" | "small" | "ul"
 * }} ContentNode
 */

/**
 * Escape hatch for less common HTML elements. Prefer the specialized types
 * above when one exists; arbitrary attributes belong in `attrs`.
 *
 * @typedef {NodeFields & {
 *   tagName: Exclude<keyof HTMLElementTagNameMap,
 *     "a" | "img" | "button" | "input" | "select" | "textarea" | "form" |
 *     "label" | "address" | "article" | "aside" | "blockquote" | "div" |
 *     "footer" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "header" |
 *     "li" | "main" | "nav" | "ol" | "p" | "pre" | "section" | "span" |
 *     "strong" | "em" | "small" | "ul">
 * }} GenericNode
 */

/**
 * The complete declarative node accepted by JaDyDoCo.
 *
 * @typedef {AnchorNode | ImageNode | ButtonNode | InputNode | SelectNode |
 *   TextareaNode | FormNode | LabelNode | ContentNode | GenericNode} JaDyNode
 */

/**
 * Configuration used by renderRemote.
 *
 * @typedef {Object} RemoteRenderConfig
 * @property {string} url
 * @property {(data: unknown) => JaDyNode | JaDyNode[]} template
 * @property {HTMLElement} [wrapper]
 * @property {RequestInit} [options]
 */

const RESERVED_KEYS = new Set([
  "tagName",
  "children",
  "text",
  "html",
  "events",
  "attrs",
  "dataset",
  "style",
  "pieces",
  "options",
  "data",
  "template",
]);

export class JaDyDoCo {
  /**
   * Creates a new JaDyDoCo application instance.
   *
   * The constructor optionally accepts a root element
   * or a selector string that will later be used as the
   * default render target.
   *
   * @param {HTMLElement|string|null} root
   */

  constructor(root = null) {
    this.root = typeof root === "string" ? document.querySelector(root) : root;
  }

  /**
   * Mounts and renders a node structure into a target element.
   *
   * This method resolves the root element, stores it internally
   * and starts the recursive rendering process.
   *
   * @param {HTMLElement|string} root
   * @param {JaDyNode|JaDyNode[]} node
   * @returns {HTMLElement|Array}
   */

  mount(root, node) {
    const target =
      typeof root === "string" ? document.querySelector(root) : root;

    if (!target) {
      throw new Error("JaDyDoCo.mount: root element not found.");
    }

    this.root = target;
    return this.render(node, target);
  }

  /**
   * Recursively renders node objects into DOM elements.
   *
   * Supports:
   * - single node objects
   * - arrays of node objects
   * - nested children structures
   *
   * The method creates elements and appends them
   * recursively to the DOM tree.
   *
   * @param {JaDyNode|JaDyNode[]} node
   * @param {HTMLElement} wrapper
   * @returns {HTMLElement|Array|null}
   */

  render(node, wrapper = this.root) {
    if (!wrapper) {
      throw new Error("JaDyDoCo.render: no wrapper/root element provided.");
    }

    if (!node) return null;

    if (Array.isArray(node)) {
      const elements = node.map((item) => this.createTree(item));
      const fragment = document.createDocumentFragment();

      fragment.append(...elements);
      wrapper.appendChild(fragment);

      return elements;
    }

    const element = this.createTree(node);
    wrapper.appendChild(element);

    return element;
  }

  /**
   * Builds a complete DOM subtree without attaching it to the document.
   * This keeps rendering atomic: if any child fails, no partial tree has
   * reached the target wrapper yet.
   *
   * @param {JaDyNode} node
   * @returns {HTMLElement}
   */

  createTree(node) {
    const element = this.createElement(node);

    if (Array.isArray(node.children)) {
      const fragment = document.createDocumentFragment();

      node.children.forEach((child) => {
        if (Array.isArray(child)) {
          child.forEach((item) => fragment.appendChild(this.createTree(item)));
          return;
        }

        fragment.appendChild(this.createTree(child));
      });

      element.appendChild(fragment);
    }

    return element;
  }

  /**
   * Creates a single DOM element from a node object.
   *
   * This method handles:
   * - element creation
   * - attribute collection
   * - dataset binding
   * - style application
   * - content rendering
   * - event binding
   * - select options generation
   *
   * @param {JaDyNode} node
   * @returns {HTMLElement}
   */

  createElement(node) {
    if (!node?.tagName) {
      throw new Error("JaDyDoCo.createElement: node needs a tagName.");
    }

    const element = document.createElement(node.tagName);
    const attrs = this.collectAttributes(node);

    this.applyAttributes(element, attrs);
    this.applyDataset(element, node.dataset);
    this.applyStyles(element, node.style);
    this.applyContent(element, node);
    this.applyEvents(element, node.events);
    this.applyOptions(element, node.options);

    return element;
  }

  /**
   * Collects all non-reserved node properties
   * and converts them into HTML attributes.
   *
   * Reserved keys are excluded automatically.
   *
   * Example:
   * {
   *   id: "hero",
   *   class: "section"
   * }
   *
   * becomes:
   *
   * {
   *   id: "hero",
   *   class: "section"
   * }
   *
   * @param {JaDyNode} node
   * @returns {AttributeMap}
   */

  collectAttributes(node) {
    const attrs = { ...(node.attrs ?? {}) };

    Object.entries(node).forEach(([key, value]) => {
      if (!RESERVED_KEYS.has(key)) {
        attrs[key] = value;
      }
    });

    return attrs;
  }

  /**
   * Applies HTML attributes to a DOM element.
   *
   * Handles:
   * - standard attributes
   * - boolean attributes
   * - class delegation
   * - htmlFor mapping
   *
   * Automatically ignores:
   * - null
   * - undefined
   * - false
   *
   * @param {HTMLElement} element
   * @param {AttributeMap} attrs
   */

  applyAttributes(element, attrs = {}) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === false || value === null || value === undefined) return;

      if (key === "class") {
        this.applyClasses(element, value);
        return;
      }

      if (key === "for") {
        element.htmlFor = value;
        return;
      }

      if (value === true) {
        element.setAttribute(key, "");
        return;
      }

      element.setAttribute(key, String(value));
    });
  }

  /**
   * Applies CSS classes to a DOM element.
   *
   * Supports:
   * - single class strings
   * - arrays of classes
   *
   * Example:
   * class: ["card", "active"]
   *
   * @param {HTMLElement} element
   * @param {ClassValue} classValue
   */

  applyClasses(element, classValue) {
    if (!classValue) return;

    if (Array.isArray(classValue)) {
      element.classList.add(...classValue.filter(Boolean));
      return;
    }

    element.className = String(classValue);
  }

  /**
   * Applies dataset values to a DOM element.
   *
   * Example:
   * dataset: {
   *   id: "123"
   * }
   *
   * becomes:
   *
   * data-id="123"
   *
   * @param {HTMLElement} element
   * @param {DatasetMap} dataset
   */

  applyDataset(element, dataset = {}) {
    Object.entries(dataset).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        element.dataset[key] = String(value);
      }
    });
  }

  /**
   * Applies inline styles to a DOM element.
   *
   * Example:
   * style: {
   *   color: "red",
   *   backgroundColor: "black"
   * }
   *
   * @param {HTMLElement} element
   * @param {StyleMap} styles
   */

  applyStyles(element, styles = {}) {
    Object.entries(styles).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        element.style[key] = value;
      }
    });
  }

  /**
   * Applies text or HTML content to a DOM element.
   *
   * text:
   * Uses textContent for safe plain text rendering.
   *
   * html:
   * Uses innerHTML for direct HTML rendering.
   *
   * Note:
   * text and html should not be used together.
   *
   * @param {HTMLElement} element
   * @param {JaDyNode} node
   */

  applyContent(element, node) {
    if (node.text !== undefined) {
      element.textContent = String(node.text);
    }

    if (node.html !== undefined) {
      element.innerHTML = String(node.html);
    }
  }

  /**
   * Binds event listeners to a DOM element.
   *
   * Example:
   * events: {
   *   click: () => console.log("clicked")
   * }
   *
   * Supports all native browser events.
   *
   * @param {HTMLElement} element
   * @param {EventMap} events
   */

  applyEvents(element, events = {}) {
    Object.entries(events).forEach(([eventName, handler]) => {
      if (typeof handler === "function") {
        element.addEventListener(eventName, handler);
      }
    });
  }

  /**
   * Generates <option> elements for <select> fields.
   *
   * Example:
   * options: [
   *   { value: "1", text: "Option 1" }
   * ]
   *
   * Supports:
   * - selected
   * - disabled
   *
   * @param {HTMLSelectElement} element
   * @param {SelectOption[]} options
   */

  applyOptions(element, options) {
    if (element.tagName !== "SELECT" || !Array.isArray(options)) return;

    options.forEach((item) => {
      const option = document.createElement("option");

      option.value = item.value ?? item.text ?? "";
      option.textContent = item.text ?? item.value ?? "";

      if (item.selected) option.selected = true;
      if (item.disabled) option.disabled = true;

      element.appendChild(option);
    });
  }

  /**
   * Removes all child elements from a wrapper element.
   *
   * Uses replaceChildren() for fast DOM cleanup.
   *
   * @param {HTMLElement} wrapper
   */

  clear(wrapper = this.root) {
    if (!wrapper) return;
    wrapper.replaceChildren();
  }

  /**
   * Replaces the current wrapper content
   * with a newly rendered node structure.
   *
   * Internally:
   * - clears wrapper
   * - renders new nodes
   *
   * @param {JaDyNode|JaDyNode[]} node
   * @param {HTMLElement} wrapper
   * @returns {HTMLElement|Array}
   */

  replace(node, wrapper = this.root) {
    if (!wrapper) {
      throw new Error("JaDyDoCo.render: no wrapper/root element provided.");
    }

    if (!node) {
      wrapper.replaceChildren();
      return null;
    }

    if (Array.isArray(node)) {
      const elements = node.map((item) => this.createTree(item));
      const fragment = document.createDocumentFragment();

      fragment.append(...elements);
      wrapper.replaceChildren(fragment);

      return elements;
    }

    const element = this.createTree(node);
    wrapper.replaceChildren(element);

    return element;
  }

  /**
   * Fetches remote JSON data and renders it
   * using a template function.
   *
   * Workflow:
   * fetch()
   * → response.json()
   * → template(data)
   * → render()
   *
   * Example:
   *
   * app.renderRemote({
   *   url: "/api/projects",
   *   template: (data) => ({
   *     tagName: "section",
   *     children: data.map(...)
   *   })
   * });
   *
   * @param {RemoteRenderConfig} config
   *
   * @returns {Promise<HTMLElement|Array>}
   */

  async renderRemote({ url, template, wrapper = this.root, options = {} }) {
    if (!url) {
      throw new Error("JaDyDoCo.renderRemote: url is required.");
    }

    if (typeof template !== "function") {
      throw new Error("JaDyDoCo.renderRemote: template must be a function.");
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(
        `JaDyDoCo.renderRemote: request failed with ${response.status}.`,
      );
    }

    const data = await response.json();
    const node = template(data);

    return this.replace(node, wrapper);
  }
}

/**
 * Creates and returns a new JaDyDoCo instance.
 *
 * Helper factory function for easier initialization.
 *
 * Example:
 * const app = createApp("#app");
 *
 * @param {HTMLElement|string|null} root
 * @returns {JaDyDoCo}
 */

export const createApp = (root) => new JaDyDoCo(root);
