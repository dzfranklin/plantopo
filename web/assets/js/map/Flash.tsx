import {
  InformationCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/20/solid";
import { XMarkIcon } from "@heroicons/react/24/solid";
import classNames from "../classNames";
import { clearFlash, selectActiveFlash } from "./flashSlice";
import { useAppDispatch, useAppSelector } from "./hooks";

export default function Flash() {
  const dispatch = useAppDispatch();
  const active = useAppSelector(selectActiveFlash);

  return (
    <>
      {active && (
        <div
          role="alert"
          onClick={() => dispatch(clearFlash())}
          className={classNames("flash", `flash--${active.kind}`)}
        >
          <p className="flash-title">
            {active.kind === "info" && (
              <InformationCircleIcon className="flash-title-icon" />
            )}

            {active.kind === "error" && (
              <ExclamationCircleIcon className="flash-title-icon" />
            )}

            {active.title}
          </p>

          {active.body && <p className="flash-body">{active.body}</p>}

          <button type="button" className="flash-close" area-label="close">
            <XMarkIcon className="flash-close-icon" />
          </button>
        </div>
      )}
    </>
  );
}
