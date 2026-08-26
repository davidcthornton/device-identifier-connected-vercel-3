'use client';

import { useEffect, useState, FormEvent } from 'react';

type DeviceType =
  | 'desktop'
  | 'laptop'
  | 'smartphone'
  | 'tablet'
  | 'externaldrive'
  | 'removablemedia'
  | 'router'
  | 'other';

export default function Page() {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [deviceName, setDeviceName] = useState<string>('unknown');
  const [deviceType, setDeviceType] = useState<DeviceType>('other');
  const [responseHtml, setResponseHtml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [openerOrigin, setOpenerOrigin] = useState<string | null>(null);

  const serverURL = '/api/image';

  // Calculate opener origin on the client safely
  useEffect(() => {
    if (typeof document !== 'undefined' && document.referrer) {
      try {
        const origin = new URL(document.referrer).origin;
        setOpenerOrigin(origin);
      } catch (err) {
        console.error('Error parsing referrer', err);
      }
    }
  }, []);

  // Allow both pick-from-folder and camera captures to accumulate
  const appendToSelected = (files: FileList | null) => {
    if (!files) return;
    setSelectedImages((prev) => [...prev, ...Array.from(files)]);
  };

  const handleSend = () => {
    if (!openerOrigin || !window.opener) return;

    const deviceData = {
      deviceName,
      deviceType,
      // optional array of File objects (can be empty)
      images: selectedImages,
    };

    window.opener.postMessage(deviceData, openerOrigin);
    window.close();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResponseHtml('');

    const form = e.currentTarget;
    const formData = new FormData(form);

    const fileInputs = form.querySelectorAll<HTMLInputElement>('input[name="images"]');
    const allFiles = Array.from(fileInputs).flatMap((inp) =>
      Array.from(inp.files ?? []),
    );

    if (allFiles.length === 0) {
      setLoading(false);
      setResponseHtml('Please select or capture at least one image.');
      return;
    }

    setSelectedImages(allFiles);

    try {
      console.log('API base URL:', process.env.NEXT_PUBLIC_API_URL);
      console.log('serverURL is ' + serverURL);

      const res = await fetch(serverURL, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.reply) {
        console.log(data.reply);
        const inputString: string = data.reply as string;

        const devices = [
          'desktop',
          'laptop',
          'smartphone',
          'tablet',
          'externaldrive',
          'removablemedia',
          'router',
          'other',
        ] as const;

        // Extract device name after "Device:"
        const match = inputString.match(/Device:\s*([^,]+)/);
        const detectedName = match ? match[1].trim() : 'unknown';
        setDeviceName(detectedName);
        console.log('Detected device name: ', detectedName);

        // Infer device type from text
        const lowerInput = inputString.toLowerCase();
        const foundDevice =
          devices.find((device) => lowerInput.includes(device)) ?? 'other';

        setDeviceType(foundDevice);
        console.log('Detected device type:', foundDevice);

        setResponseHtml(`<p>${data.reply}</p>`);
      } else {
        setResponseHtml('Unexpected response format.');
      }
    } catch (err) {
      console.error(err);
      setResponseHtml('Error contacting server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="Page">
      <h1 className="text-2xl font-bold mb-4">Device Identifier</h1>

      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="space-y-4"
      >
        {/* Either/Or Section */}
        <fieldset
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '16px',
          }}
        >
          <label className="filepicker">
            <span>Select Images</span>
            <input
              type="file"
              name="images"
              accept="image/*"
              multiple
              onChange={(e) => appendToSelected(e.target.files)}
            />
          </label>


          <p> or </p>

          {/* Hidden camera capture input */}
          <input
            id="cameraInput"
            type="file"
            name="images"
            accept="image/*"
            capture="environment" // Prefer rear camera on mobile
            multiple
            style={{ display: 'none' }}
            onChange={(e) => appendToSelected(e.target.files)}
          />

          {/* Visible button to trigger the camera input */}
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() =>
                document.getElementById('cameraInput')?.click()
              }
              style={{ display: 'flex', alignItems: 'left' }}
            >
              📷 Take Photos
            </button>
          </div>
        </fieldset>

        <div style={{ marginTop: 20 }}>
          <button
            type="submit"
            className="gray-button"
            disabled={loading}
            style={{
              fontWeight: 'bold',
              padding: '10px 20px',
              borderRadius: '6px',
              marginTop: '10px',
              border: '2px solid rgba(0,0,0)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <img
              src="/assets/upload.svg"
              alt="upload icon"
              className="icon"
              style={{ width: '30px', height: '30px', marginRight: '8px' }}
            />
            {loading ? 'Identifying...' : 'Identify Now'}
          </button>
        </div>
      </form>

      <div className="tips">
        <strong>Tips:</strong>
        <ol>
          <li>
            For best results, take two photos, front and back, or from different
            angles/sides
          </li>
          <li>If applicable, remove protective cover</li>
        </ol>
        <img
          src="/assets/removingProtectiveSleeveFromSmartphone.png"
          alt="Removing protective sleeve from smartphone"
          style={{ width: '40%', height: 'auto' }}
        />
      </div>

      <div
        id="response"
        className="resultBox"
        dangerouslySetInnerHTML={{ __html: responseHtml }}
      />

      {openerOrigin && (
        <button className="gray-button" onClick={handleSend}>
          Back to Case Manager
        </button>
      )}
    </div>
  );
}
