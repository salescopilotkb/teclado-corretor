package com.corretorkeyboard

import android.app.Application
import android.content.res.Configuration
import com.corretorkeyboard.keyboard.KeyboardBridgePackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactNativeHost
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

/**
 * React Native 0.81 + Expo SDK 54 (arquitetura antiga, como o teclado precisa).
 * O ReactNativeHostWrapper do Expo liga os módulos do Expo no MESMO ReactInstanceManager
 * que o teclado (CustomKeyboardService) reaproveita.
 */
class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      ReactNativeHostWrapper(
          this,
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
          })

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    // React Native 0.81: carrega as bibliotecas nativas (e a arquitetura nova, se ligada)
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
