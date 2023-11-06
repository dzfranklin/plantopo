import { useEffect } from 'react';

export function FaroSDK() {
  useEffect(function () {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') {
      console.info('Faro SDK not loaded as not production');
      return;
    }
    if (window.location.hostname.endsWith('pt-staging.dfusercontent.com')) {
      console.info('Faro SDK not loaded as staging');
      return;
    }

    if (document.getElementById('faro-web-sdk')) {
      // Already loading
      return;
    }

    const webSdkScript = document.createElement('script');
    webSdkScript.id = 'faro-web-sdk';

    webSdkScript.src =
      'https://unpkg.com/@grafana/faro-web-sdk@^1.0.0/dist/bundle/faro-web-sdk.iife.js';

    webSdkScript.onload = () => {
      (window as any).GrafanaFaroWebSdk.initializeFaro({
        url: 'https://faro-collector-prod-eu-west-2.grafana.net/collect/348cd06d590b255eee8d4ed366bb0604',
        app: {
          name: 'pt-app',
          version: process.env.NEXT_PUBLIC_PT_VER ?? '<unspecified>',
          environment: 'production',
        },
      });

      // Load instrumentations at the onLoad event of the web-SDK and after the above configuration.
      // This is important because we need to ensure that the Web-SDK has been loaded and initialized before we add further instruments!
      const webTracingScript = document.createElement('script');

      webTracingScript.src =
        'https://unpkg.com/@grafana/faro-web-tracing@^1.0.0/dist/bundle/faro-web-tracing.iife.js';

      // Initialize, configure (if necessary) and add the the new instrumentation to the already loaded and configured Web-SDK.
      webTracingScript.onload = () => {
        (window as any).GrafanaFaroWebSdk.faro.instrumentations.add(
          new (window as any).GrafanaFaroWebTracing.TracingInstrumentation(),
        );
      };

      // Append the Web Tracing script script tag to the HTML page
      document.head.appendChild(webTracingScript);
    };

    // Append the Web-SDK script script tag to the HTML page
    document.head.appendChild(webSdkScript);
  }, []);

  return <></>;
}
