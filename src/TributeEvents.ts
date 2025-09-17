interface KeyMapping {
  key: number;
  value: string;
}

class TributeEvents {
  tribute: any;
  commandEvent: boolean;
  inputEvent: boolean;

  constructor(tribute: any) {
    this.tribute = tribute;
    this.tribute.events = this;
  }

  static keys(): KeyMapping[] {
    return [
      {
        key: 9,
        value: "TAB"
      },
      {
        key: 8,
        value: "DELETE"
      },
      {
        key: 13,
        value: "ENTER"
      },
      {
        key: 27,
        value: "ESCAPE"
      },
      {
        key: 32,
        value: "SPACE"
      },
      {
        key: 38,
        value: "UP"
      },
      {
        key: 40,
        value: "DOWN"
      }
    ];
  }

  bind(element: Element): void {
    (element as any).boundKeydown = this.keydown.bind(element, this);
    (element as any).boundKeyup = this.keyup.bind(element, this);
    (element as any).boundInput = this.input.bind(element, this);

    element.addEventListener("keydown", (element as any).boundKeydown, true);
    element.addEventListener("keyup", (element as any).boundKeyup, true);
    element.addEventListener("input", (element as any).boundInput, true);
  }

  unbind(element: Element): void {
    element.removeEventListener("keydown", (element as any).boundKeydown, true);
    element.removeEventListener("keyup", (element as any).boundKeyup, true);
    element.removeEventListener("input", (element as any).boundInput, true);

    delete (element as any).boundKeydown;
    delete (element as any).boundKeyup;
    delete (element as any).boundInput;
  }

  keydown(this: Element, instance: TributeEvents, event: KeyboardEvent): void {
    if (instance.shouldDeactivate(event)) {
      instance.tribute.isActive = false;
      instance.tribute.hideMenu();
    }

    let element = this;
    instance.commandEvent = false;

    TributeEvents.keys().forEach(o => {
      if (o.key === event.keyCode) {
        instance.commandEvent = true;
        instance.callbacks()[o.value.toLowerCase()](event, element);
      }
    });
  }

  input(this: Element, instance: TributeEvents, event: Event): void {
    instance.inputEvent = true;
    instance.keyup.call(this, instance, event);
  }

  click(instance: TributeEvents, event: MouseEvent): void {
    let tribute = instance.tribute;
    if (tribute.menu && tribute.menu.contains(event.target)) {
      let li = event.target as HTMLElement;
      event.preventDefault();
      event.stopPropagation();
      while (li.nodeName.toLowerCase() !== "li") {
        li = li.parentNode as HTMLElement;
        if (!li || li === tribute.menu) {
          throw new Error("cannot find the <li> container for the click");
        }
      }
      tribute.selectItemAtIndex(li.getAttribute("data-index"), event);
      tribute.hideMenu();

      // TODO: should fire with externalTrigger and target is outside of menu
    } else if (tribute.current.element && !tribute.current.externalTrigger) {
      tribute.current.externalTrigger = false;
      setTimeout(() => tribute.hideMenu());
    }
  }

  keyup(this: Element, instance: TributeEvents, event: KeyboardEvent): void {
    if (instance.inputEvent) {
      instance.inputEvent = false;
    }
    instance.updateSelection(this);

    if (!event.keyCode || event.keyCode === 27) return;

    if (!instance.tribute.allowSpaces && instance.tribute.hasTrailingSpace) {
      instance.tribute.hasTrailingSpace = false;
      instance.commandEvent = true;
      instance.callbacks()["space"](event, this);
      return;
    }

    if (!instance.tribute.isActive) {
      if (instance.tribute.autocompleteMode) {
        instance.callbacks().triggerChar(event, this, "");
      } else {
        let keyCode = instance.getKeyCode(instance, this, event);

        if (!keyCode || isNaN(keyCode)) return;

        let trigger = instance.tribute.triggers().find(trigger => {
          return trigger.charCodeAt(0) === keyCode;
        });

        if (typeof trigger !== "undefined") {
          instance.callbacks().triggerChar(event, this, trigger);
        }
      }
    }

    if (
      instance.tribute.current.mentionText.length <
      instance.tribute.current.collection.menuShowMinLength
    ) {
      return;
    }

    if (
      ((instance.tribute.current.trigger ||
        instance.tribute.autocompleteMode) &&
        instance.commandEvent === false) ||
      (instance.tribute.isActive && event.keyCode === 8)
    ) {
      instance.tribute.showMenuFor(this, true);
    }
  }

  shouldDeactivate(event: KeyboardEvent): boolean {
    if (!this.tribute.isActive) return false;

    if (this.tribute.current.mentionText.length === 0) {
      let eventKeyPressed = false;
      TributeEvents.keys().forEach(o => {
        if (event.keyCode === o.key) eventKeyPressed = true;
      });

      return !eventKeyPressed;
    }

    return false;
  }

  getKeyCode(instance: TributeEvents, el: Element, event: KeyboardEvent): number | false {
    let char;
    let tribute = instance.tribute;
    let info = tribute.range.getTriggerInfo(
      false,
      tribute.hasTrailingSpace,
      true,
      tribute.allowSpaces,
      tribute.autocompleteMode
    );

    if (info) {
      return info.mentionTriggerChar.charCodeAt(0);
    } else {
      return false;
    }
  }

  updateSelection(el: Element): void {
    this.tribute.current.element = el;
    let info = this.tribute.range.getTriggerInfo(
      false,
      this.tribute.hasTrailingSpace,
      true,
      this.tribute.allowSpaces,
      this.tribute.autocompleteMode
    );

    if (info) {
      this.tribute.current.selectedPath = info.mentionSelectedPath;
      this.tribute.current.mentionText = info.mentionText;
      this.tribute.current.selectedOffset = info.mentionSelectedOffset;
    }
  }

  callbacks(): { [key: string]: (e: Event, el: Element, trigger?: string) => void } {
    return {
      triggerChar: (e, el, trigger) => {
        let tribute = this.tribute;
        tribute.current.trigger = trigger;

        let collectionItem = tribute.collection.find(item => {
          return item.trigger === trigger;
        });

        tribute.current.collection = collectionItem;

        if (
          tribute.current.mentionText.length >=
            tribute.current.collection.menuShowMinLength &&
          tribute.inputEvent
        ) {
          tribute.showMenuFor(el, true);
        }
      },
      enter: (e, el) => {
        // choose selection
        if (this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          setTimeout(() => {
            this.tribute.selectItemAtIndex(this.tribute.menuSelected, e);
            this.tribute.hideMenu();
          }, 0);
        }
      },
      escape: (e, el) => {
        if (this.tribute.isActive) {
          e.preventDefault();
          e.stopPropagation();
          this.tribute.isActive = false;
          this.tribute.hideMenu();
        }
      },
      tab: (e, el) => {
        // choose first match
        this.callbacks().enter(e, el);
      },
      space: (e, el) => {
        if (this.tribute.isActive) {
          if (this.tribute.spaceSelectsMatch) {
            this.callbacks().enter(e, el);
          } else if (!this.tribute.allowSpaces) {
            e.stopPropagation();
            setTimeout(() => {
              this.tribute.hideMenu();
              this.tribute.isActive = false;
            }, 0);
          }
        }
      },
      up: (e, el) => {
        // navigate up ul
        if (this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          let count = this.tribute.current.filteredItems.length,
            selected = this.tribute.menuSelected;

          if (count > selected && selected > 0) {
            this.tribute.menuSelected--;
            this.setActiveLi();
          } else if (selected === 0) {
            this.tribute.menuSelected = count - 1;
            this.setActiveLi();
            this.tribute.menu.scrollTop = this.tribute.menu.scrollHeight;
          }
        }
      },
      down: (e, el) => {
        // navigate down ul
        if (this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          let count = this.tribute.current.filteredItems.length - 1,
            selected = this.tribute.menuSelected;

          if (count > selected) {
            this.tribute.menuSelected++;
            this.setActiveLi();
          } else if (count === selected) {
            this.tribute.menuSelected = 0;
            this.setActiveLi();
            this.tribute.menu.scrollTop = 0;
          }
        }
      },
      delete: (e, el) => {
        if (
          this.tribute.isActive &&
          this.tribute.current.mentionText.length < 1
        ) {
          this.tribute.hideMenu();
        } else if (this.tribute.isActive) {
          this.tribute.showMenuFor(el);
        }
      }
    };
  }

  setActiveLi(index?: number): void {
    let lis = this.tribute.menu.querySelectorAll("li"),
      length = lis.length >>> 0;

    if (index) this.tribute.menuSelected = index;

    for (let i = 0; i < length; i++) {
      let li = lis[i];
      if (i === this.tribute.menuSelected) {
        li.classList.add(this.tribute.current.collection.selectClass);

        let liClientRect = li.getBoundingClientRect();
        let menuClientRect = this.tribute.menu.getBoundingClientRect();

        if (liClientRect.bottom > menuClientRect.bottom) {
          let scrollDistance = liClientRect.bottom - menuClientRect.bottom;
          this.tribute.menu.scrollTop += scrollDistance;
        } else if (liClientRect.top < menuClientRect.top) {
          let scrollDistance = menuClientRect.top - liClientRect.top;
          this.tribute.menu.scrollTop -= scrollDistance;
        }
      } else {
        li.classList.remove(this.tribute.current.collection.selectClass);
      }
    }
  }

  getFullHeight(elem: Element, includeMargin?: boolean): number {
    let height = elem.getBoundingClientRect().height;

    if (includeMargin) {
      let style = (elem as any).currentStyle || window.getComputedStyle(elem);
      return (
        height + parseFloat(style.marginTop) + parseFloat(style.marginBottom)
      );
    }

    return height;
  }
}

export default TributeEvents;
