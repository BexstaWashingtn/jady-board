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
   * @param {Object|Array} node
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
   * @param {Object|Array} node
   * @param {HTMLElement} wrapper
   * @returns {HTMLElement|Array|null}
   */

  render(node, wrapper = this.root) {
    if (!wrapper) {
      throw new Error("JaDyDoCo.render: no wrapper/root element provided.");
    }

    if (!node) return null;

    if (Array.isArray(node)) {
      return node.map((item) => this.render(item, wrapper));
    }

    const element = this.createElement(node);
    wrapper.appendChild(element);

    if (Array.isArray(node.children)) {
      node.children.forEach((child) => this.render(child, element));
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
   * @param {Object} node
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
   * @param {Object} node
   * @returns {Object}
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
   * @param {Object} attrs
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
   * @param {string|string[]} classValue
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
   * @param {Object} dataset
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
   * @param {Object} styles
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
   * @param {Object} node
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
   * @param {Object} events
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
   * @param {Array} options
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
   * @param {Object|Array} node
   * @param {HTMLElement} wrapper
   * @returns {HTMLElement|Array}
   */

  replace(node, wrapper = this.root) {
    this.clear(wrapper);
    return this.render(node, wrapper);
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
   * @param {Object} config
   * @param {string} config.url
   * @param {Function} config.template
   * @param {HTMLElement} config.wrapper
   * @param {Object} config.options
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
