/**
 * Parse User-Agent string into a human-readable device description.
 * Extracts browser name/version and OS name without external dependencies.
 */
export function parseDeviceInfo(userAgent: string | undefined): string {
  if (!userAgent) return 'Unknown Device';

  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Detect Browser
  if (userAgent.includes('Edg/')) {
    const match = userAgent.match(/Edg\/([\d.]+)/);
    browser = `Edge ${match && match[1] ? match[1].split('.')[0] : ''}`.trim();
  } else if (userAgent.includes('OPR/') || userAgent.includes('Opera')) {
    const match = userAgent.match(/OPR\/([\d.]+)/);
    browser = `Opera ${match && match[1] ? match[1].split('.')[0] : ''}`.trim();
  } else if (userAgent.includes('Chrome/') && !userAgent.includes('Chromium')) {
    const match = userAgent.match(/Chrome\/([\d.]+)/);
    browser = `Chrome ${match && match[1] ? match[1].split('.')[0] : ''}`.trim();
  } else if (userAgent.includes('Firefox/')) {
    const match = userAgent.match(/Firefox\/([\d.]+)/);
    browser = `Firefox ${match && match[1] ? match[1].split('.')[0] : ''}`.trim();
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/([\d.]+)/);
    browser = `Safari ${match && match[1] ? match[1].split('.')[0] : ''}`.trim();
  } else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
    browser = 'Internet Explorer';
  }

  // Detect OS
  if (userAgent.includes('Windows NT 10.0')) {
    os = 'Windows 10/11';
  } else if (userAgent.includes('Windows NT 6.3')) {
    os = 'Windows 8.1';
  } else if (userAgent.includes('Windows NT 6.1')) {
    os = 'Windows 7';
  } else if (userAgent.includes('Mac OS X')) {
    const match = userAgent.match(/Mac OS X ([\d_]+)/);
    os = `macOS ${match && match[1] ? match[1].replace(/_/g, '.') : ''}`.trim();
  } else if (userAgent.includes('Android')) {
    const match = userAgent.match(/Android ([\d.]+)/);
    os = `Android ${match && match[1] ? match[1] : ''}`.trim();
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    const match = userAgent.match(/OS ([\d_]+)/);
    os = `iOS ${match && match[1] ? match[1].replace(/_/g, '.') : ''}`.trim();
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('CrOS')) {
    os = 'Chrome OS';
  }

  return `${browser} / ${os}`;
}
