import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  ScanLine,
  UserRound,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { staffRequest } from "../../services/staffApi";
import "./QRScanner.css";

const IST = "Asia/Kolkata";

function formatScanTime(value) {
  if (!value) return "—";
  return `${new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value))} IST`;
}

function ScanDetails({ data, scanTime, status, duplicate }) {
  const student = data?.student || {};
  const menu = data?.menu || {};
  const rows = [
    ["Student Name", student.name],
    ["Student ID", student.studentId],
    ["Registered Email", student.email],
    ["Hostel", student.hostel],
    ["Mess Unit", student.messUnit],
    ["Meal", menu.meal ? menu.meal.charAt(0).toUpperCase() + menu.meal.slice(1) : null],
    ["Food Category", menu.category || menu.mealCategory],
    [duplicate ? "Previous Successful Scan Time" : "Scan Time", formatScanTime(scanTime)],
    ["Attendance Status", status],
  ];

  return (
    <dl className="staff-qr-result-details">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{label === "Food Category" && value ? String(value).toUpperCase() : value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function QRScanner() {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const scannerRef = useRef(null);
  const scannerRunningRef = useRef(false);
  const scannerStartingRef = useRef(false);
  const verifyingRef = useRef(false);
  const mountedRef = useRef(false);
  const lifecycleRef = useRef(0);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner || !scannerRunningRef.current) return;

    try {
      await scanner.stop();
    } catch (stopError) {
      if (mountedRef.current) {
        setCameraError(
          stopError?.message || "Unable to stop the camera. Close the page to release it."
        );
      }
    } finally {
      scannerRunningRef.current = false;
      if (mountedRef.current) setCameraActive(false);
    }
  }, []);

  const verifyToken = useCallback(async (qrPayload) => {
    try {
      const data = await staffRequest("/api/staff/qr/verify", {
        method: "POST",
        body: JSON.stringify({ token: qrPayload }),
      });
      setResult({ ...data, resultType: "success" });
    } catch (requestError) {
      const data = requestError.data || {};
      setResult({
        ...data,
        resultType: data.code === "already_scanned" || data.status === "already_served"
          ? "duplicate"
          : "error",
        title: data.title || "QR Verification Failed",
        message: data.message || requestError.message,
      });
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  }, []);

  const startScanner = useCallback(async (generation = lifecycleRef.current) => {
    if (scannerStartingRef.current || scannerRunningRef.current || verifyingRef.current) return;
    scannerStartingRef.current = true;
    setCameraError("");

    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!mountedRef.current || generation !== lifecycleRef.current) return;
      if (!cameras.length) {
        throw new Error("No camera device is available. Connect a camera and try again.");
      }

      const scanner = scannerRef.current || new Html5Qrcode("staff-qr-reader");
      scannerRef.current = scanner;
      const onDecoded = async (decodedText) => {
        if (!decodedText || verifyingRef.current) return;
        verifyingRef.current = true;
        setVerifying(true);
        await stopScanner();
        await verifyToken(decodedText);
      };
      const config = {
        fps: 10,
        qrbox: (width, height) => {
          const size = Math.floor(Math.min(width, height) * 0.72);
          return { width: size, height: size };
        },
        aspectRatio: 1,
      };
      const onDecodeFailure = () => {};
      const rearCamera = cameras.find((camera) => /back|rear|environment/i.test(camera.label));
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const preferredCamera = rearCamera?.id || (isMobile ? { facingMode: "environment" } : cameras[0].id);

      try {
        await scanner.start(preferredCamera, config, onDecoded, onDecodeFailure);
      } catch (cameraError) {
        if (typeof preferredCamera !== "object" || !cameras[0]?.id) throw cameraError;
        await scanner.start(cameras[0].id, config, onDecoded, onDecodeFailure);
      }

      if (!mountedRef.current || generation !== lifecycleRef.current) {
        await scanner.stop();
        return;
      }
      scannerRunningRef.current = true;
      setCameraActive(true);
    } catch (startError) {
      if (mountedRef.current && generation === lifecycleRef.current) {
        const message = startError?.message || "";
        setCameraError(
          /notallowed|permission denied|denied/i.test(`${startError?.name || ""} ${message}`)
            ? "Camera access was denied. Allow camera permission in your browser settings, then try again."
            : message || "Unable to access the camera. Check that it is connected and not in use by another app."
        );
      }
    } finally {
      scannerStartingRef.current = false;
    }
  }, [stopScanner, verifyToken]);

  useEffect(() => {
    mountedRef.current = true;
    const generation = ++lifecycleRef.current;
    const startTimer = window.setTimeout(() => {
      startScanner(generation);
    }, 0);

    return () => {
      mountedRef.current = false;
      lifecycleRef.current += 1;
      window.clearTimeout(startTimer);
      void stopScanner();
    };
  }, [startScanner, stopScanner]);

  const scanAnotherStudent = async () => {
    if (verifyingRef.current) return;
    setResult(null);
    setCameraError("");
    await stopScanner();
    await startScanner();
  };

  const resultType = result?.resultType;
  const isSuccess = resultType === "success";
  const isDuplicate = resultType === "duplicate";
  const displayedScanTime = isDuplicate ? result?.originalScanTime : result?.scanTime;

  return (
    <main className="staff-qr-page">
      <header className="staff-qr-heading">
        <div className="staff-qr-heading-icon"><ScanLine size={23} /></div>
        <div>
          <h1>QR Code Scanner</h1>
          <p>Scan Student QR Code to Mark Meal Attendance</p>
        </div>
      </header>

      <section className="staff-qr-workspace">
        <div className="staff-qr-camera-card">
          <div className="staff-qr-camera-header">
            <div>
              <span className="staff-qr-eyebrow">STAFF ATTENDANCE</span>
              <h2>Student Meal Pass</h2>
            </div>
            <span className={`staff-qr-camera-status${cameraActive ? " active" : ""}`}>
              <i /> {cameraActive ? "Camera Active" : verifying ? "Verifying" : "Camera Inactive"}
            </span>
          </div>

          <div className="staff-qr-viewfinder">
            <div id="staff-qr-reader" />
            <div className="staff-qr-frame" aria-hidden="true">
              <i className="top-left" />
              <i className="top-right" />
              <i className="bottom-left" />
              <i className="bottom-right" />
            </div>
            {!cameraActive && !verifying && !result && (
              <div className="staff-qr-camera-placeholder">
                <Camera size={35} />
                <strong>Camera preview will appear here</strong>
                <span>Allow camera access to start scanning.</span>
              </div>
            )}
            {verifying && (
              <div className="staff-qr-verifying" role="status">
                <LoaderCircle size={30} className="staff-qr-spinner" />
                <strong>Verifying QR code…</strong>
              </div>
            )}
          </div>

          <p className="staff-qr-instruction">
            Point your camera at the student&apos;s QR code.
          </p>

          {cameraError && (
            <div className="staff-qr-camera-error" role="alert">
              <AlertTriangle size={18} />
              <span>{cameraError}</span>
            </div>
          )}

          {!result && (
            <div className="staff-qr-camera-controls">
              <button
                type="button"
                className="staff-qr-control-primary"
                onClick={() => startScanner()}
                disabled={cameraActive || verifying}
              >
                <Camera size={17} /> {cameraActive ? "Camera Active" : "Start Camera"}
              </button>
              <button
                type="button"
                className="staff-qr-control-secondary"
                onClick={stopScanner}
                disabled={!cameraActive || verifying}
              >
                Stop Camera
              </button>
            </div>
          )}
        </div>

        {result && (
          <section
            className={`staff-qr-result-card ${isSuccess ? "success" : isDuplicate ? "duplicate" : "failure"}`}
            aria-live="polite"
          >
            <div className="staff-qr-result-heading">
              <div className="staff-qr-result-icon">
                {isSuccess ? <CheckCircle2 size={38} /> : isDuplicate ? <BadgeCheck size={38} /> : <AlertTriangle size={38} />}
              </div>
              <div>
                <span className="staff-qr-eyebrow">SCAN RESULT</span>
                <h2>
                  {isSuccess
                    ? "QR SCANNED SUCCESSFULLY!"
                    : isDuplicate
                      ? "ALREADY QR SCANNED"
                      : result.title}
                </h2>
                {!isSuccess && <p>{result.description || result.message}</p>}
              </div>
            </div>

            {(isSuccess || isDuplicate) && (
              <ScanDetails
                data={result}
                scanTime={displayedScanTime}
                status={isSuccess ? "VERIFIED" : "QR SCANNED"}
                duplicate={isDuplicate}
              />
            )}

            <button
              type="button"
              className="staff-qr-scan-another"
              onClick={scanAnotherStudent}
              disabled={verifying}
            >
              <ScanLine size={19} />
              SCAN ANOTHER STUDENT
            </button>
          </section>
        )}
      </section>

      <aside className="staff-qr-security-note">
        <UserRound size={17} />
        Attendance is verified against the student&apos;s meal response and your assigned hostel, mess, and category.
        <span><MapPin size={15} /> Scan times are recorded in IST</span>
        <span><Clock3 size={15} /> Only active meal sessions can be verified</span>
      </aside>
    </main>
  );
}
