package com.corretorkeyboard

import android.app.Application
import com.corretorkeyboard.keyboard.KeyboardBridgePackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Registra a ponte do teclado customizado
              add(KeyboardBridgePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        // Desativa DevSupport para que o app leia SEMPRE os assets locais (index.android.bundle)
        // e não tente conectar ao Metro server (localhost:8081) em dispositivos reais.
        override fun getUseDeveloperSupport(): Boolean = false

        // O teclado roda em segundo plano através de um InputMethodService (sem Activity)
        override fun getShouldRequireActivity(): Boolean = false

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    // React Native 0.77: as bibliotecas nativas vêm juntas num arquivo só
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
  }
}
