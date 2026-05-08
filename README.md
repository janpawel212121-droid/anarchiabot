# HEARTFARM panel

To jest statyczny panel admina pod Supabase. Frontend:

- loguje przez Supabase Auth
- czyta dane z Postgresa
- zapisuje akcje do tabeli `command_queue`
- odswieza sie po zmianach w bazie

## Szybki start lokalnie

1. Otworz projekt Supabase i uruchom SQL z [supabase-setup.sql](/C:/Users/janpa/Desktop/boty/top/bonskoshopp.pl/heartfarm/7124/supabase-setup.sql).
2. Skopiuj `supabase-config.example.js` do `supabase-config.js`.
3. Wpisz tam `supabaseUrl` i `supabaseAnonKey`.
4. W Supabase Dashboard utworz uzytkownika admina w Auth.
5. Uruchom lokalnie [start-heartfarm.cmd](/C:/Users/janpa/Desktop/boty/top/bonskoshopp.pl/heartfarm/7124/start-heartfarm.cmd).
6. Wejdz na `http://127.0.0.1:7124`.

## Co robi `command_queue`

Panel nie steruje botami bezposrednio. Zamiast tego:

- zapisuje komende do `command_queue`
- Twoj backend / worker botow powinien pobierac rekordy ze statusem `pending`
- po wykonaniu powinien ustawic `status = 'done'` albo `status = 'error'`
- worker powinien tez aktualizowac tabele `victim_stats`, `victim_hearts`, `killer_bots`, `system_logs`, `web_logs`

To jest najlepszy uklad, bo frontend moze byc hostowany statycznie, a logika botow dziala osobno i bezpiecznie.

## Hosting

Najprostsza opcja: Vercel.

- wrzucasz ten folder do repo
- importujesz repo do Vercel
- `vercel.json` robi rewrite z `/` i `/baza/:slug` na panel
- nie potrzebujesz Node backendu na produkcji, jesli uzywasz samego Supabase

Mozesz tez wrzucic to na Cloudflare Pages albo Netlify, ale dla tego projektu Vercel jest najprostszy przez gotowy rewrite.

## Zaleznosci Socket.IO / Engine.IO

Jesli chcesz odtworzyc lokalnie zaleznosci i strukture folderow z poprzedniej wersji projektu, uruchom:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-socket-deps.ps1
```

Skrypt:

- pobiera zgodne wersje paczek z npm registry
- odtwarza lokalne `node_modules`
- synchronizuje foldery:
  - `build/esm-debug`
  - `engine.io-client/build/esm`
  - `engine.io-parser/build/esm`
  - `socket.io-component-emitter/lib/esm`
  - `socket.io-parser/build/esm`
