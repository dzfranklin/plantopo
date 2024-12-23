export function WaitForReportComponent() {
  return (
    <div>
      <p className="text-base mb-4 800">
        Your report has been added to the queue.
      </p>
      <p className="text-gray-800">
        Generating a report typically takes at least five minutes. This page
        will update automatically when your report is ready.
      </p>

      <div className="flex justify-center pt-4">
        <video
          src="/munro-access/report_building_animation.webm"
          autoPlay
          loop
          muted
          playsInline
          width="300px"
          height="300px"
        />
      </div>
    </div>
  );
}
