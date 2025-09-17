// Thanks to https://github.com/jeff-collins/ment.io


interface Coordinates {
    position?: string;
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
    maxHeight?: number;
    maxWidth?: number;
}

type FinalCoordinates = Omit<Coordinates, 'top'|'left'> & {
     top?: number | 'auto';
    left?: number | 'auto';
}

interface MenuDimensions {
    width: number;
    height: number;
}

interface TriggerInfo {
    mentionPosition: number;
    mentionText: string;
    mentionSelectedElement: Element | null;
    mentionSelectedPath?: number[];
    mentionSelectedOffset?: number;
    mentionTriggerChar?: string;
}

class TributeRange {
    tribute: any;
    menu: Element;

    constructor(tribute: any) {
        this.tribute = tribute
        this.tribute.range = this
    }

    getDocument(): Document {
        let iframe
        if (this.tribute.current.collection) {
            iframe = this.tribute.current.collection.iframe
        }

        if (!iframe) {
            return document
        }

        return iframe.contentWindow.document
    }

    positionMenuAtCaret(scrollTo?: boolean): void {
        let context = this.tribute.current,
            coordinates:FinalCoordinates

        let info = this.getTriggerInfo(false, this.tribute.hasTrailingSpace, true, this.tribute.allowSpaces, this.tribute.autocompleteMode)

        if (typeof info !== 'undefined') {

            if(!this.tribute.positionMenu){
                this.tribute.menu.style.cssText = `display: block;`
                return
            }

            if (!this.isContentEditable(context.element)) {
                coordinates = this.getTextAreaOrInputUnderlinePosition(this.tribute.current.element,
                    info.mentionPosition)
            }
            else {
                coordinates = this.getContentEditableCaretPosition(info.mentionPosition)
            }

            this.tribute.menu.style.cssText = `top: ${coordinates.top}px;
                                     left: ${coordinates.left}px;
                                     right: ${coordinates.right}px;
                                     bottom: ${coordinates.bottom}px;
                                     max-height: ${coordinates.maxHeight || 500}px;
                                     max-width: ${coordinates.maxWidth || 300}px;
                                     position: ${coordinates.position || 'absolute'};
                                     display: block;`

            if (coordinates.left === 'auto') {
                this.tribute.menu.style.left = 'auto'
            }

            if (coordinates.top === 'auto') {
                this.tribute.menu.style.top = 'auto'
            }

            if (scrollTo) this.scrollIntoView()

        } else {
            this.tribute.menu.style.cssText = 'display: none'
        }
    }

    get menuContainerIsBody(): boolean {
        return this.tribute.menuContainer === document.body || !this.tribute.menuContainer;
    }


    selectElement(targetElement: HTMLElement, path?: number[], offset?: number): void {
        let range
        let elem = targetElement

        if (path) {
            for (var i = 0; i < path.length; i++) {
                elem = elem.childNodes[path[i]] as HTMLElement
                if (elem === undefined) {
                    return
                }
                while ((elem as any).length < offset) {
                    offset -= (elem as any).length
                    elem = elem.nextSibling as HTMLElement
                }
                if (elem.childNodes.length === 0 && !(elem as any).length) {
                    elem = elem.previousSibling as HTMLElement
                }
            }
        }
        let sel = this.getWindowSelection()

        range = this.getDocument().createRange()
        range.setStart(elem, offset)
        range.setEnd(elem, offset)
        range.collapse(true)

        try {
            sel.removeAllRanges()
        } catch (error) {}

        sel.addRange(range)
        targetElement.focus()
    }

    replaceTriggerText(text: string, requireLeadingSpace?: boolean, hasTrailingSpace?: boolean, originalEvent?: Event, item?: any): void {
        let info = this.getTriggerInfo(true, hasTrailingSpace, requireLeadingSpace, this.tribute.allowSpaces, this.tribute.autocompleteMode)

        if (info !== undefined) {
            let context = this.tribute.current
            let replaceEvent = new CustomEvent('tribute-replaced', {
                detail: {
                    item: item,
                    instance: context,
                    context: info,
                    event: originalEvent,
                }
            })

            if (!this.isContentEditable(context.element)) {
                let myField = this.tribute.current.element
                let textSuffix = typeof this.tribute.replaceTextSuffix == 'string'
                    ? this.tribute.replaceTextSuffix
                    : ' '
                text += textSuffix
                let startPos = info.mentionPosition
                let endPos = info.mentionPosition + info.mentionText.length + (textSuffix === '' ? 1 : textSuffix.length)
                if (!this.tribute.autocompleteMode) {
                    endPos += info.mentionTriggerChar.length - 1
                }
                myField.value = myField.value.substring(0, startPos) + text +
                    myField.value.substring(endPos, myField.value.length)
                myField.selectionStart = startPos + text.length
                myField.selectionEnd = startPos + text.length
            } else {
                // add a space to the end of the pasted text
                let textSuffix = typeof this.tribute.replaceTextSuffix == 'string'
                    ? this.tribute.replaceTextSuffix
                    : '\xA0'
                text += textSuffix
                let endPos = info.mentionPosition + info.mentionText.length
                if (!this.tribute.autocompleteMode) {
                    endPos += info.mentionTriggerChar.length
                }
                this.pasteHtml(text, info.mentionPosition, endPos)
            }

            context.element.dispatchEvent(new CustomEvent('input', { bubbles: true }))
            context.element.dispatchEvent(replaceEvent)
        }
    }

    pasteHtml(html: string, startPos: number, endPos: number): void {
        let range, sel
        sel = this.getWindowSelection()
        range = this.getDocument().createRange()
        range.setStart(sel.anchorNode, startPos)
        range.setEnd(sel.anchorNode, endPos)
        range.deleteContents()

        let el = this.getDocument().createElement('div')
        el.innerHTML = html
        let frag = this.getDocument().createDocumentFragment(),
            node, lastNode
        while ((node = el.firstChild)) {
            lastNode = frag.appendChild(node)
        }
        range.insertNode(frag)

        // Preserve the selection
        if (lastNode) {
            range = range.cloneRange()
            range.setStartAfter(lastNode)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
        }
    }

    getWindowSelection(): Selection | null {
        if (this.tribute.collection.iframe) {
            return this.tribute.collection.iframe.contentWindow.getSelection()
        }

        return window.getSelection()
    }

    getNodePositionInParent(element: Node): number {
        if (element.parentNode === null) {
            return 0
        }

        for (var i = 0; i < element.parentNode.childNodes.length; i++) {
            let node = element.parentNode.childNodes[i]

            if (node === element) {
                return i
            }
        }
    }

    getContentEditableSelectedPath(ctx: any): { selected: Element; path: number[]; offset: number } | undefined {
        let sel = this.getWindowSelection()
        let selected = sel.anchorNode as HTMLElement
        let path = []
        let offset

        if (selected != null) {
            let i
            let ce = selected.contentEditable
            while (selected !== null && ce !== 'true') {
                i = this.getNodePositionInParent(selected)
                path.push(i)
                selected = selected.parentNode as HTMLElement
                if (selected !== null) {
                    ce = selected.contentEditable
                }
            }
            path.reverse()

            // getRangeAt may not exist, need alternative
            offset = sel.getRangeAt(0).startOffset

            return {
                selected: selected,
                path: path,
                offset: offset
            }
        }
    }

    getTextPrecedingCurrentSelection(): string {
        let context = this.tribute.current,
            text = ''

        if (!this.isContentEditable(context.element)) {
            let textComponent = this.tribute.current.element;
            if (textComponent) {
                let startPos = textComponent.selectionStart
                if (textComponent.value && startPos >= 0) {
                    text = textComponent.value.substring(0, startPos)
                }
            }

        } else {
            let selectedElem = this.getWindowSelection().anchorNode

            if (selectedElem != null) {
                let workingNodeContent = selectedElem.textContent
                let selectStartOffset = this.getWindowSelection().getRangeAt(0).startOffset

                if (workingNodeContent && selectStartOffset >= 0) {
                    text = workingNodeContent.substring(0, selectStartOffset)
                }
            }
        }

        return text
    }

    getLastWordInText(text: string): string {
        var wordsArray;
        if (this.tribute.autocompleteSeparator) {
            wordsArray = text.split(this.tribute.autocompleteSeparator);
        } else {
            wordsArray = text.split(/\s+/);
        }
        var wordsCount = wordsArray.length - 1;
        return wordsArray[wordsCount];
    }

    getTriggerInfo(menuAlreadyActive?: boolean, hasTrailingSpace?: boolean, requireLeadingSpace?: boolean, allowSpaces?: boolean, isAutocomplete?: boolean): TriggerInfo | undefined {
        let ctx = this.tribute.current
        let selected, path, offset

        if (!this.isContentEditable(ctx.element)) {
            selected = this.tribute.current.element
        } else {
            let selectionInfo = this.getContentEditableSelectedPath(ctx)

            if (selectionInfo) {
                selected = selectionInfo.selected
                path = selectionInfo.path
                offset = selectionInfo.offset
            }
        }

        let effectiveRange = this.getTextPrecedingCurrentSelection()
        let lastWordOfEffectiveRange = this.getLastWordInText(effectiveRange)

        if (isAutocomplete) {
            return {
                mentionPosition: effectiveRange.length - lastWordOfEffectiveRange.length,
                mentionText: lastWordOfEffectiveRange,
                mentionSelectedElement: selected,
                mentionSelectedPath: path,
                mentionSelectedOffset: offset
            }
        }

        if (effectiveRange !== undefined && effectiveRange !== null) {
            let mostRecentTriggerCharPos = -1
            let triggerChar

            this.tribute.collection.forEach(config => {
                let c = config.trigger
                let idx = config.requireLeadingSpace ?
                    this.lastIndexWithLeadingSpace(effectiveRange, c) :
                    effectiveRange.lastIndexOf(c)

                if (idx > mostRecentTriggerCharPos) {
                    mostRecentTriggerCharPos = idx
                    triggerChar = c
                    requireLeadingSpace = config.requireLeadingSpace
                }
            })

            if (mostRecentTriggerCharPos >= 0 &&
                (
                    mostRecentTriggerCharPos === 0 ||
                    !requireLeadingSpace ||
                    /\s/.test(
                        effectiveRange.substring(
                            mostRecentTriggerCharPos - 1,
                            mostRecentTriggerCharPos)
                    )
                )
            ) {
                let currentTriggerSnippet = effectiveRange.substring(mostRecentTriggerCharPos + triggerChar.length,
                    effectiveRange.length)

                triggerChar = effectiveRange.substring(mostRecentTriggerCharPos, mostRecentTriggerCharPos + triggerChar.length)
                let firstSnippetChar = currentTriggerSnippet.substring(0, 1)
                let leadingSpace = currentTriggerSnippet.length > 0 &&
                    (
                        firstSnippetChar === ' ' ||
                        firstSnippetChar === '\xA0'
                    )
                if (hasTrailingSpace) {
                    currentTriggerSnippet = currentTriggerSnippet.trim()
                }

                let regex = allowSpaces ? /[^\S ]/g : /[\xA0\s]/g;

                this.tribute.hasTrailingSpace = regex.test(currentTriggerSnippet);

                if (!leadingSpace && (menuAlreadyActive || !(regex.test(currentTriggerSnippet)))) {
                    return {
                        mentionPosition: mostRecentTriggerCharPos,
                        mentionText: currentTriggerSnippet,
                        mentionSelectedElement: selected,
                        mentionSelectedPath: path,
                        mentionSelectedOffset: offset,
                        mentionTriggerChar: triggerChar
                    }
                }
            }
        }
    }

    lastIndexWithLeadingSpace(str: string, trigger: string): number {
        let reversedStr = str.split('').reverse().join('')
        let index = -1

        for (let cidx = 0, len = str.length; cidx < len; cidx++) {
            let firstChar = cidx === str.length - 1
            let leadingSpace = /\s/.test(reversedStr[cidx + 1])

            let match = true
            for (let triggerIdx = trigger.length - 1; triggerIdx >= 0; triggerIdx--) {
              if (trigger[triggerIdx] !== reversedStr[cidx-triggerIdx]) {
                match = false
                break
              }
            }

            if (match && (firstChar || leadingSpace)) {
                index = str.length - 1 - cidx
                break
            }
        }

        return index
    }

    isContentEditable(element: Element): boolean {
        return element.nodeName !== 'INPUT' && element.nodeName !== 'TEXTAREA'
    }

    isMenuOffScreen(coordinates: Coordinates, menuDimensions: MenuDimensions): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
        let windowWidth = window.innerWidth
        let windowHeight = window.innerHeight
        let doc = document.documentElement
        let windowLeft = (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0)
        let windowTop = (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0)

        let menuTop = typeof coordinates.top === 'number' ? coordinates.top : windowTop + windowHeight - coordinates.bottom - menuDimensions.height
        let menuRight = typeof coordinates.right === 'number' ? coordinates.right : coordinates.left + menuDimensions.width
        let menuBottom = typeof coordinates.bottom === 'number' ? coordinates.bottom : coordinates.top + menuDimensions.height
        let menuLeft = typeof coordinates.left === 'number' ? coordinates.left : windowLeft + windowWidth - coordinates.right - menuDimensions.width

        return {
            top: menuTop < Math.floor(windowTop),
            right: menuRight > Math.ceil(windowLeft + windowWidth),
            bottom: menuBottom > Math.ceil(windowTop + windowHeight),
            left: menuLeft < Math.floor(windowLeft)
        }
    }

    getMenuDimensions(): MenuDimensions {
        // Width of the menu depends of its contents and position
        // We must check what its width would be without any obstruction
        // This way, we can achieve good positioning for flipping the menu
        let dimensions = {
            width: null,
            height: null
        }

        this.tribute.menu.style.cssText = `top: 0px;
                                 left: 0px;
                                 position: fixed;
                                 display: block;
                                 visibility; hidden;
                                 max-height:500px;`
       dimensions.width = this.tribute.menu.offsetWidth
       dimensions.height = this.tribute.menu.offsetHeight

       this.tribute.menu.style.cssText = `display: none;`

       return dimensions
    }

    getTextAreaOrInputUnderlinePosition(element: HTMLElement, position: number, flipped?: boolean): FinalCoordinates {
        let properties = ['direction', 'boxSizing', 'width', 'height', 'overflowX',
            'overflowY', 'borderTopWidth', 'borderRightWidth',
            'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'paddingTop',
            'paddingRight', 'paddingBottom', 'paddingLeft',
            'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch',
            'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily',
            'textAlign', 'textTransform', 'textIndent',
            'textDecoration', 'letterSpacing', 'wordSpacing'
        ]

        let isFirefox = ((window as any).mozInnerScreenX !== null)

        let div = this.getDocument().createElement('div')
        div.id = 'input-textarea-caret-position-mirror-div'
        this.getDocument().body.appendChild(div)

        let style = div.style
        let computed:CSSStyleDeclaration = window.getComputedStyle ? getComputedStyle(element) : (element as any).currentStyle

        style.whiteSpace = 'pre-wrap'
        if (element.nodeName !== 'INPUT') {
            style.wordWrap = 'break-word'
        }

        style.position = 'absolute'
        style.visibility = 'hidden'

        // transfer the element's properties to the div
        properties.forEach(prop => {
            style[prop] = computed[prop]
        })

        //NOT SURE WHY THIS IS HERE AND IT DOESNT SEEM HELPFUL
        // if (isFirefox) {
        //     style.width = `${(parseInt(computed.width) - 2)}px`
        //     if (element.scrollHeight > parseInt(computed.height))
        //         style.overflowY = 'scroll'
        // } else {
        //     style.overflow = 'hidden'
        // }

        let span0 = document.createElement('span')
        span0.textContent =  (element as any).value.substring(0, position)
        div.appendChild(span0)

        if (element.nodeName === 'INPUT') {
            div.textContent = div.textContent.replace(/\s/g, ' ')
        }

        //Create a span in the div that represents where the cursor
        //should be
        let span = this.getDocument().createElement('span')
        //we give it no content as this represents the cursor
        span.textContent = '&#x200B;'
        div.appendChild(span)

        let span2 = this.getDocument().createElement('span');
        span2.textContent = (element as any).value.substring(position);
        div.appendChild(span2);

        let rect = element.getBoundingClientRect()

        //position the div exactly over the element
        //so we can get the bounding client rect for the span and
        //it should represent exactly where the cursor is
        div.style.position = 'fixed';
        div.style.left = rect.left + 'px';
        div.style.top = rect.top + 'px';
        div.style.width = rect.width + 'px';
        div.style.height = rect.height + 'px';
        div.scrollTop = element.scrollTop;

        var spanRect = span.getBoundingClientRect();
        this.getDocument().body.removeChild(div)
        return this.getFixedCoordinatesRelativeToRect(spanRect);
    }

    getContentEditableCaretPosition(selectedNodePosition: number): FinalCoordinates {
        let range
        let sel = this.getWindowSelection()

        range = this.getDocument().createRange()
        range.setStart(sel.anchorNode, selectedNodePosition)
        range.setEnd(sel.anchorNode, selectedNodePosition)

        range.collapse(false)

        let rect = range.getBoundingClientRect()

        return this.getFixedCoordinatesRelativeToRect(rect);
    }

    getFixedCoordinatesRelativeToRect(rect: DOMRect): FinalCoordinates {
        let coordinates: FinalCoordinates = {
            position: 'fixed',
            left: rect.left,
            top: rect.top + rect.height
        }

        let menuDimensions = this.getMenuDimensions()

        var availableSpaceOnTop = rect.top;
        var availableSpaceOnBottom = window.innerHeight - (rect.top + rect.height);

        //check to see where's the right place to put the menu vertically
        if (availableSpaceOnBottom < menuDimensions.height) {
          if (availableSpaceOnTop >= menuDimensions.height || availableSpaceOnTop > availableSpaceOnBottom) {
            coordinates.top = 'auto';
            coordinates.bottom = window.innerHeight - rect.top;
            if (availableSpaceOnBottom < menuDimensions.height) {
              coordinates.maxHeight = availableSpaceOnTop;
            }
          } else {
            if (availableSpaceOnTop < menuDimensions.height) {
              coordinates.maxHeight = availableSpaceOnBottom;
            }
          }
        }

        var availableSpaceOnLeft = rect.left;
        var availableSpaceOnRight = window.innerWidth - rect.left;

        //check to see where's the right place to put the menu horizontally
        if (availableSpaceOnRight < menuDimensions.width) {
          if (availableSpaceOnLeft >= menuDimensions.width || availableSpaceOnLeft > availableSpaceOnRight) {
            coordinates.left = 'auto';
            coordinates.right = window.innerWidth - rect.left;
            if (availableSpaceOnRight < menuDimensions.width) {
              coordinates.maxWidth = availableSpaceOnLeft;
            }
          } else {
            if (availableSpaceOnLeft < menuDimensions.width) {
              coordinates.maxWidth = availableSpaceOnRight;
            }
          }
        }

        return coordinates
    }

    scrollIntoView(elem?: Element): void {
        let reasonableBuffer = 20,
            clientRect
        let maxScrollDisplacement = 100
        let e = this.menu

        if (typeof e === 'undefined') return;

        while (clientRect === undefined || clientRect.height === 0) {
            clientRect = e.getBoundingClientRect()

            if (clientRect.height === 0) {
                e = e.childNodes[0] as Element
                if (e === undefined || !e.getBoundingClientRect) {
                    return
                }
            }
        }

        let elemTop = clientRect.top
        let elemBottom = elemTop + clientRect.height

        if (elemTop < 0) {
            window.scrollTo(0, window.pageYOffset + clientRect.top - reasonableBuffer)
        } else if (elemBottom > window.innerHeight) {
            let maxY = window.pageYOffset + clientRect.top - reasonableBuffer

            if (maxY - window.pageYOffset > maxScrollDisplacement) {
                maxY = window.pageYOffset + maxScrollDisplacement
            }

            let targetY = window.pageYOffset - (window.innerHeight - elemBottom)

            if (targetY > maxY) {
                targetY = maxY
            }

            window.scrollTo(0, targetY)
        }
    }
}


export default TributeRange;
