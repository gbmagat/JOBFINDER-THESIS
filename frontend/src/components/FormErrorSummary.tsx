import type {
  FormEvent,
  RefObject,
} from "react";

export type FormValidationIssue = {
  fieldId: string;
  message: string;
};

type ValidatableControl =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement;

function validatableControls(form: HTMLFormElement): ValidatableControl[] {
  return Array.from(
    form.querySelectorAll<ValidatableControl>("input, select, textarea"),
  ).filter((control) => control.willValidate);
}

export function collectFormValidationIssues(
  form: HTMLFormElement,
): FormValidationIssue[] {
  return validatableControls(form).flatMap((control, index) => {
    control.removeAttribute("aria-invalid");
    control.closest(".field")?.removeAttribute("data-validation-error");

    if (control.checkValidity()) return [];

    if (!control.id) {
      control.id = `${form.id || "form"}-field-${index + 1}`;
    }
    const message = control.validationMessage || "Check this field.";
    control.setAttribute("aria-invalid", "true");
    control.setAttribute(
      "aria-describedby",
      `${control.id}-validation-error`,
    );
    control
      .closest(".field")
      ?.setAttribute("data-validation-error", message);

    return [{ fieldId: control.id, message }];
  });
}

export function clearNativeFieldError(
  event: FormEvent<HTMLFormElement>,
) {
  const target = event.target;
  if (
    !(
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    )
  ) {
    return;
  }

  if (target.checkValidity()) {
    target.removeAttribute("aria-invalid");
    if (
      target
        .getAttribute("aria-describedby")
        ?.includes("-validation-error")
    ) {
      target.removeAttribute("aria-describedby");
    }
    target.closest(".field")?.removeAttribute("data-validation-error");
  }
}

export function FormErrorSummary({
  issues,
  summaryRef,
  title,
}: {
  issues: FormValidationIssue[];
  summaryRef: RefObject<HTMLDivElement | null>;
  title: string;
}) {
  if (!issues.length) return null;

  return (
    <div
      className="form-error-summary"
      ref={summaryRef}
      role="alert"
      tabIndex={-1}
    >
      <h2>{title}</h2>
      <ul>
        {issues.map((issue) => (
          <li key={issue.fieldId}>
            <a
              href={`#${issue.fieldId}`}
              id={`${issue.fieldId}-validation-error`}
            >
              {issue.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

