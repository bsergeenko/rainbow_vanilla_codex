# Rainbow.design

Frontend mit HTML, CSS und Vanilla JavaScript, ohne Laufzeitabhängigkeiten. Die vorhandene API und alle Bilddateien werden von `http://localhost:3000` geladen. Das Backend wird separat gestartet und nicht verändert.

## Start

Voraussetzung: Node.js 22 oder neuer und das laufende Backend.

```sh
npm start
```

Danach `http://localhost:5173` öffnen. Unter Windows mit gesperrten PowerShell-Skripten `npm.cmd start` verwenden. Für Session-Cookies den Hostnamen `localhost` benutzen. Der Frontend-Server liefert ausschließlich statische Dateien und unterstützt direkte Seitenaufrufe.

## Technische Prüfung

```sh
npm run check
npm test
```

Die Browserprüfung benötigt den laufenden Frontend-Server und Google Chrome. Bei abweichendem Installationspfad kann `CHROME_PATH` gesetzt werden. Sie prüft die echte Produkt-API, Bilder, den Gastwarenkorb sowie die Oberfläche auf Desktop, Tablet und Smartphone. Schreibende Konto-, Bestell- und Adminaktionen werden mit dem Chrome-DevTools-Protokoll abgefangen und gegen isolierte Testdaten geprüft; bestehende Backend-Daten werden dabei nicht geändert. Ergebnisse und Screenshots stehen anschließend unter `tests/artifacts/`.

Die Anwendung nutzt die Backend-Session mit `credentials: "include"`. Wunschliste und Warenkorb liegen beim Backend. Eine Bestellbestätigung wird für den aktuellen Browser-Tab in `sessionStorage` aufbewahrt; Kartendaten werden weder gespeichert noch übertragen. Sie werden nach erfolgreicher Bestellung aus dem Formular entfernt.

Bei drei Motiven stimmt die in der API angegebene `.jpg`-Endung nicht mit der vorhandenen Datei überein. Die Bildbehandlung probiert bei einem Ladefehler die vorhandenen Dateiformate `.jpeg` und `.png` im selben Asset-Verzeichnis. API-Daten, Dateinamen und Verzeichnisse bleiben unverändert.
