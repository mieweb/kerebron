import { Attrs } from 'prosemirror-model';

const CSS_PREFIX = 'kb-prompt';

export function openPrompt(options: {
  title: string;
  fields: { [name: string]: Field };
  callback: (attrs: Attrs) => void;
}) {
  // Create a backdrop to capture clicks outside the modal
  let backdrop = document.body.appendChild(document.createElement('div'));
  backdrop.className = CSS_PREFIX + '-backdrop';
  backdrop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1299;';
  
  let wrapper = document.body.appendChild(document.createElement('div'));
  wrapper.className = CSS_PREFIX;

  let close = () => {
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  };

  // Click on backdrop closes the modal
  backdrop.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  let domFields: HTMLElement[] = [];
  for (let name in options.fields) {
    domFields.push(options.fields[name].render());
  }

  let submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = CSS_PREFIX + '--submit';
  submitButton.textContent = 'OK';
  let cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = CSS_PREFIX + '--cancel';
  cancelButton.textContent = 'Cancel';
  // Use click event - mousedown caused issues with events falling through to toolbar
  cancelButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  let form = wrapper.appendChild(document.createElement('form'));
  if (options.title) {
    form.appendChild(document.createElement('h5')).textContent = options.title;
  }
  domFields.forEach((field) => {
    form.appendChild(document.createElement('div')).appendChild(field);
  });
  let buttons = form.appendChild(document.createElement('div'));
  buttons.className = CSS_PREFIX + '__buttons';
  buttons.appendChild(submitButton);
  buttons.appendChild(document.createTextNode(' '));
  buttons.appendChild(cancelButton);

  let box = wrapper.getBoundingClientRect();
  wrapper.style.top = ((globalThis.innerHeight - box.height) / 2) + 'px';
  wrapper.style.left = ((globalThis.innerWidth - box.width) / 2) + 'px';

  let submit = () => {
    let params = getValues(options.fields, domFields);
    if (params) {
      close();
      options.callback(params);
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });

  form.addEventListener('keydown', (e) => {
    if (e.keyCode == 27) {
      e.preventDefault();
      close();
    } else if (e.keyCode == 13 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
      e.preventDefault();
      submit();
    } else if (e.keyCode == 9) {
      globalThis.setTimeout(() => {
        if (!wrapper.contains(document.activeElement)) close();
      }, 500);
    }
  });

  let input = form.elements[0] as HTMLElement;
  if (input) input.focus();
}

function getValues(
  fields: { [name: string]: Field },
  domFields: readonly HTMLElement[],
) {
  let result = Object.create(null), i = 0;
  for (let name in fields) {
    let field = fields[name], dom = domFields[i++];
    let value = field.read(dom), bad = field.validate(value);
    if (bad) {
      reportInvalid(dom, bad);
      return null;
    }
    result[name] = field.clean(value);
  }
  return result;
}

function reportInvalid(dom: HTMLElement, message: string) {
  // FIXME this is awful and needs a lot more work
  let parent = dom.parentNode!;
  let msg = parent.appendChild(document.createElement('div'));
  msg.style.left = (dom.offsetLeft + dom.offsetWidth + 2) + 'px';
  msg.style.top = (dom.offsetTop - 5) + 'px';
  msg.className = 'kb-invalid';
  msg.textContent = message;
  setTimeout(() => parent.removeChild(msg), 1500);
}

/// The type of field that `openPrompt` expects to be passed to it.
export abstract class Field {
  /// Create a field with the given options. Options support by all
  /// field types are:
  constructor(
    /// @internal
    readonly options: {
      /// The starting value for the field.
      value?: any;

      /// The label for the field.
      label: string;

      /// Whether the field is required.
      required?: boolean;

      /// A function to validate the given value. Should return an
      /// error message if it is not valid.
      validate?: (value: any) => string | null;

      /// A cleanup function for field values.
      clean?: (value: any) => any;
    },
  ) {}

  /// Render the field to the DOM. Should be implemented by all subclasses.
  abstract render(): HTMLElement;

  /// Read the field's value from its DOM node.
  read(dom: HTMLElement) {
    return (dom as any).value;
  }

  /// A field-type-specific validation function.
  validateType(value: any): string | null {
    return null;
  }

  /// @internal
  validate(value: any): string | null {
    if (!value && this.options.required) {
      return 'Required field';
    }
    return this.validateType(value) ||
      (this.options.validate ? this.options.validate(value) : null);
  }

  clean(value: any): any {
    return this.options.clean ? this.options.clean(value) : value;
  }
}

/// A field class for single-line text fields.
export class TextField extends Field {
  render() {
    let input = document.createElement('input');
    input.type = 'text';
    input.placeholder = this.options.label;
    input.value = this.options.value || '';
    input.autocomplete = 'off';
    return input;
  }
}

/// A field class for dropdown fields based on a plain `<select>`
/// tag. Expects an option `options`, which should be an array of
/// `{value: string, label: string}` objects, or a function taking a
/// `ProseMirror` instance and returning such an array.
export class SelectField extends Field {
  render() {
    let select = document.createElement('select');
    ((this.options as any).options as { value: string; label: string }[])
      .forEach((o) => {
        let opt = select.appendChild(document.createElement('option'));
        opt.value = o.value;
        opt.selected = o.value == this.options.value;
        opt.label = o.label;
      });
    return select;
  }
}
