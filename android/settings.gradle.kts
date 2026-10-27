pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Official pre-compiled OpenCV Maven repository (QuickBird / OpenCV Maven)
        maven { url = java.net.URI("https://jitpack.io") }
    }
}

rootProject.name = "PathSense"
include(":app")
