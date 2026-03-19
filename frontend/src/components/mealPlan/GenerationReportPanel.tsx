import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaBan,
  FaLock,
  FaInfoCircle,
  FaTimes,
} from "react-icons/fa";
import { GenerationReport } from "../../models/mealPlan";

interface Props {
  report: GenerationReport;
  onDismiss: () => void;
}

const warningLabels: Record<string, string> = {
  POOL_EXHAUSTED: "Pool exhausted",
  FREQUENCY_MIN_NOT_MET: "Frequency min not met",
  FREQUENCY_MAX_EXCEEDED: "Frequency max exceeded",
  CONFLICTING_CONSTRAINTS: "Conflicting constraints",
};

const GenerationReportPanel = ({ report, onDismiss }: Props) => {
  const hasWarnings = report.warnings.length > 0;
  const totalSkipped =
    report.slotsSkipped.excluded + report.slotsSkipped.locked + report.slotsSkipped.alreadyFilled;

  return (
    <div
      className={`alert ${hasWarnings ? "alert-warning" : "alert-success"} mb-4 flex-col items-start`}
    >
      <div className="flex w-full justify-between items-start">
        <div className="flex items-center gap-2">
          {hasWarnings ? (
            <FaExclamationTriangle className="w-5 h-5" />
          ) : (
            <FaCheckCircle className="w-5 h-5" />
          )}
          <span className="font-medium">Generation complete</span>
        </div>
        <button
          className="btn btn-ghost btn-xs btn-circle"
          onClick={onDismiss}
          aria-label="Dismiss report"
        >
          <FaTimes />
        </button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 mt-2 text-sm">
        <div className="flex items-center gap-1">
          <FaCheckCircle className="w-3 h-3 text-success" />
          <span>{report.slotsGenerated} generated</span>
        </div>
        {totalSkipped > 0 && (
          <div className="flex items-center gap-1">
            <FaBan className="w-3 h-3" />
            <span>
              {totalSkipped} skipped
              <span className="text-xs ml-1 opacity-70">
                ({report.slotsSkipped.excluded > 0 && `${report.slotsSkipped.excluded} excluded`}
                {report.slotsSkipped.excluded > 0 && report.slotsSkipped.locked > 0 && ", "}
                {report.slotsSkipped.locked > 0 && `${report.slotsSkipped.locked} locked`}
                {(report.slotsSkipped.excluded > 0 || report.slotsSkipped.locked > 0) &&
                  report.slotsSkipped.alreadyFilled > 0 &&
                  ", "}
                {report.slotsSkipped.alreadyFilled > 0 &&
                  `${report.slotsSkipped.alreadyFilled} already filled`}
                )
              </span>
            </span>
          </div>
        )}
        {report.slotsEmpty > 0 && (
          <div className="flex items-center gap-1">
            <FaInfoCircle className="w-3 h-3 text-warning" />
            <span>{report.slotsEmpty} left empty</span>
          </div>
        )}
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="mt-3 w-full">
          <p className="text-sm font-medium mb-1">Warnings:</p>
          <ul className="space-y-1">
            {report.warnings.map((w, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <FaExclamationTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">{warningLabels[w.type] || w.type}</span>
                  {w.tagName && (
                    <span className="badge badge-sm badge-outline ml-1">{w.tagName}</span>
                  )}
                  {w.required !== undefined && w.actual !== undefined && (
                    <span className="text-xs ml-1">
                      ({w.actual}/{w.required})
                    </span>
                  )}
                  <p className="text-xs opacity-70">{w.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default GenerationReportPanel;
