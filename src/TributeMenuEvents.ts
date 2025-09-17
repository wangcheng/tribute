class TributeMenuEvents {
  tribute: any;
  menu: Element | null;
  menuClickEvent: (event: Event) => void;
  menuContainerScrollEvent: () => void;
  windowResizeEvent: () => void;
  menuContainer: Element | null;

  constructor(tribute: any) {
    this.tribute = tribute;
    this.tribute.menuEvents = this;
    this.menu = this.tribute.menu;
  }

  bind(menu: Element): void {
    this.menuClickEvent = this.tribute.events.click.bind(null, this);
    this.menuContainerScrollEvent = this.debounce(
      () => {
        if (this.tribute.isActive) {
          this.tribute.hideMenu();
        }
      },
      10,
      false
    );
    this.windowResizeEvent = this.debounce(
      () => {
        if (this.tribute.isActive) {
          this.tribute.hideMenu();
        }
      },
      10,
      false
    );

    // fixes IE11 issues with mousedown
    this.tribute.range
      .getDocument()
      .addEventListener("MSPointerDown", this.menuClickEvent, false);
    this.tribute.range
      .getDocument()
      .addEventListener("mousedown", this.menuClickEvent, false);
    window.addEventListener("resize", this.windowResizeEvent);

    if (this.menuContainer) {
      this.menuContainer.addEventListener(
        "scroll",
        this.menuContainerScrollEvent,
        false
      );
    } else {
      window.addEventListener("scroll", this.menuContainerScrollEvent);
    }
  }

  unbind(menu: Element): void {
    this.tribute.range
      .getDocument()
      .removeEventListener("mousedown", this.menuClickEvent, false);
    this.tribute.range
      .getDocument()
      .removeEventListener("MSPointerDown", this.menuClickEvent, false);
    window.removeEventListener("resize", this.windowResizeEvent);

    if (this.menuContainer) {
      this.menuContainer.removeEventListener(
        "scroll",
        this.menuContainerScrollEvent,
        false
      );
    } else {
      window.removeEventListener("scroll", this.menuContainerScrollEvent);
    }
  }

  debounce(func: Function, wait: number, immediate?: boolean): () => void {
    var timeout;
    return (...args) => {
      var later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(this, args);
    };
  }
}

export default TributeMenuEvents;
