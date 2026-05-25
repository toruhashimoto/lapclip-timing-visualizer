package org.spacevision.lapclipviz

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity

// Browser-only viewing aid. A WebView loads the OFFICIAL LapClip result page, and
// after each page finishes loading we inject our overlay script (assets/
// lapclip-overlay.js — the same vanilla bundle as the PC bookmarklet). The app
// performs NO network requests of its own and stores/redistributes nothing; the
// overlay only reads the already-loaded DOM. Injection via evaluateJavascript is
// done by the app, so it is not subject to the page's CSP.
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var urlInput: EditText

    // Default stage URL; the user can edit it (e.g. ctg=004 for the 大鹿 team TT).
    private val defaultUrl = "https://matrix-sports.jp/lap/result.php?evt=2026_toj&ctg=001"
    private val allowedHostSuffix = "matrix-sports.jp"

    private val overlayJs: String by lazy {
        assets.open("lapclip-overlay.js").bufferedReader().use { it.readText() }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        urlInput = findViewById(R.id.urlInput)
        webView = findViewById(R.id.webView)
        val openBtn = findViewById<Button>(R.id.openBtn)
        val browserBtn = findViewById<Button>(R.id.browserBtn)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true // overlay keeps favorites/prefs in localStorage
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = true
            displayZoomControls = false
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean {
                val host = request.url.host ?: return false
                return if (host.endsWith(allowedHostSuffix)) {
                    false // keep LapClip navigation inside the WebView
                } else {
                    // open non-LapClip links (banners etc.) in the system browser
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    true
                }
            }

            override fun onPageFinished(view: WebView, url: String?) {
                super.onPageFinished(view, url)
                val host = Uri.parse(url ?: "").host ?: ""
                if (host.endsWith(allowedHostSuffix)) {
                    view.evaluateJavascript(overlayJs, null)
                }
            }
        }

        openBtn.setOnClickListener { load(urlInput.text.toString().trim()) }
        browserBtn.setOnClickListener {
            val u = urlInput.text.toString().trim()
            if (u.isNotEmpty()) startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u)))
        }

        if (savedInstanceState == null) {
            urlInput.setText(defaultUrl)
            load(defaultUrl)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    private fun load(url: String) {
        val u = when {
            url.isEmpty() -> defaultUrl
            !url.startsWith("http") -> "https://$url"
            else -> url
        }
        urlInput.setText(u)
        webView.loadUrl(u)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    @Deprecated("Back navigation through WebView history")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
