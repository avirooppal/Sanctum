; Sanctum Windows Installer Script (NSIS 3)
; Meets all requirements of ADR 0100 & Owner Mandate:
; - Per-user installation (zero admin rights required)
; - Clean silent install (/S) and custom directory (/D=...)
; - Upgrade in place with user data preservation
; - Uninstaller asking before deleting user data in %APPDATA%\Sanctum
; - No leftover registry keys or orphaned background services

Unicode true
SetCompressor /SOLID lzma

!define PRODUCT_NAME "Sanctum"
!define PRODUCT_VERSION "0.1.0"
!define PRODUCT_PUBLISHER "Sanctum Contributors"
!define PRODUCT_WEB_SITE "https://github.com/avirooppal/Sanctum"
!define MAIN_EXE "Sanctum-Desktop.exe"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

RequestExecutionLevel user

!include "MUI2.nsh"
!include "FileFunc.nsh"

; MUI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "app-icon.ico"
!define MUI_UNICON "app-icon.ico"

; Installer Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Language
!insertmacro MUI_LANGUAGE "English"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "..\..\dist\Sanctum-Setup-${PRODUCT_VERSION}-x64.exe"
InstallDir "$LOCALAPPDATA\Programs\${PRODUCT_NAME}"
InstallDirRegKey HKCU "Software\${PRODUCT_NAME}" "InstallDir"

Section "Sanctum Core (Required)" SecCore
    SectionIn RO
    SetOutPath "$INSTDIR"
    
    ; Copy binary and core files
    File "build_payload\Sanctum-Desktop.exe"
    File "..\..\LICENSE"
    File "..\..\THIRD_PARTY_NOTICES.md"
    
    ; Copy web frontend assets
    SetOutPath "$INSTDIR\resources\web"
    File /r "build_payload\resources\web\*.*"
    
    ; Copy engine and worker binaries if present
    SetOutPath "$INSTDIR\resources\bin"
    File /nonfatal "build_payload\resources\bin\*.*"

    ; Set main install directory again
    SetOutPath "$INSTDIR"
    
    ; Write uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Registry keys for Add/Remove Programs (HKCU)
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKCU "${UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" '"$INSTDIR\${MAIN_EXE}"'
    WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
    WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
    
    ; Store install path
    WriteRegStr HKCU "Software\${PRODUCT_NAME}" "InstallDir" "$INSTDIR"
SectionEnd

Section "Start Menu Shortcut" SecStartMenu
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${MAIN_EXE}" "" "$INSTDIR\${MAIN_EXE}" 0
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall ${PRODUCT_NAME}.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
SectionEnd

Section "Desktop Shortcut" SecDesktop
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${MAIN_EXE}" "" "$INSTDIR\${MAIN_EXE}" 0
SectionEnd

; Component Descriptions
LangString DESC_SecCore ${LANG_ENGLISH} "Core Sanctum desktop application, UI, and local engine components."
LangString DESC_SecStartMenu ${LANG_ENGLISH} "Add Sanctum to the Windows Start Menu."
LangString DESC_SecDesktop ${LANG_ENGLISH} "Place a shortcut to Sanctum on your Desktop."

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} $(DESC_SecCore)
    !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} $(DESC_SecStartMenu)
    !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} $(DESC_SecDesktop)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; Uninstaller Section
Section "Uninstall"
    ; Delete files
    Delete "$INSTDIR\${MAIN_EXE}"
    Delete "$INSTDIR\LICENSE"
    Delete "$INSTDIR\THIRD_PARTY_NOTICES.md"
    Delete "$INSTDIR\Uninstall.exe"
    
    RMDir /r "$INSTDIR\resources"
    RMDir "$INSTDIR"

    ; Delete shortcuts
    Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
    Delete "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall ${PRODUCT_NAME}.lnk"
    RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
    Delete "$DESKTOP\${PRODUCT_NAME}.lnk"

    ; Remove Registry keys
    DeleteRegKey HKCU "${UNINST_KEY}"
    DeleteRegKey HKCU "Software\${PRODUCT_NAME}"

    ; Ask whether to remove user data unless silent
    IfSilent CleanUserDataDone
    MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to delete your local Sanctum chat history, models, and settings in %APPDATA%\Sanctum?" IDNO CleanUserDataDone
    RMDir /r "$APPDATA\Sanctum"

CleanUserDataDone:
SectionEnd
