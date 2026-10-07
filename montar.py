"""Junta as partes do roteirizador em um único index.html."""
from pathlib import Path
RAIZ = Path(__file__).resolve().parent
P = RAIZ / "src"
css = (P / "base.css").read_text(encoding="utf-8") + (P / "extra.css").read_text(encoding="utf-8")
head = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Roteirizador de entregas | Rotas por veículo com carga e horário</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>{css}</style>
</head>
'''
corpo = (P / "corpo.html").read_text(encoding="utf-8").replace("__LOGO__", (P / "logo.txt").read_text())
fim = f'''<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
{(P / "app.js").read_text(encoding="utf-8")}</script>
</body>
</html>
'''
(RAIZ / "index.html").write_text(head + corpo + fim, encoding="utf-8")
print("index.html", len(head + corpo + fim))
