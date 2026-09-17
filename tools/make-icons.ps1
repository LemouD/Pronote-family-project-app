# Redessine les icones PNG de la PWA a partir des formes du logo Familyo.
#
# Pourquoi un script plutot qu'un export : le logo ne vit qu'une fois, dans
# src/logo.ts, et les PNG doivent en rester une copie exacte. Les coordonnees
# ci-dessous sont celles du SVG, sur le meme carre de 180 - si le logo change,
# on change les deux au meme endroit du fichier et on relance :
#
#   powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1
#
# Puis on incremente le numero de cache du service worker dans src/pwa.ts,
# sinon les appareils qui ont deja installe l'application gardent les
# anciennes icones indefiniment.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$assets = Join-Path (Split-Path -Parent $PSScriptRoot) "src\assets"

function New-Color([string]$hex, [double]$opacity = 1.0) {
  $r = [Convert]::ToInt32($hex.Substring(1, 2), 16)
  $g = [Convert]::ToInt32($hex.Substring(3, 2), 16)
  $b = [Convert]::ToInt32($hex.Substring(5, 2), 16)
  [System.Drawing.Color]::FromArgb([int][Math]::Round($opacity * 255), $r, $g, $b)
}

# Une ellipse SVG se donne par son centre et ses rayons, GDI+ par la boite
# englobante : la conversion se fait une seule fois, ici.
function Add-Ellipse($g, $cx, $cy, $rx, $ry, $fillHex, $opacity, $strokeHex, $strokeWidth) {
  $box = New-Object System.Drawing.RectangleF(($cx - $rx), ($cy - $ry), (2 * $rx), (2 * $ry))
  $brush = New-Object System.Drawing.SolidBrush(New-Color $fillHex $opacity)
  $g.FillEllipse($brush, $box)
  $brush.Dispose()
  if ($strokeHex) {
    $pen = New-Object System.Drawing.Pen((New-Color $strokeHex), [float]$strokeWidth)
    $g.DrawEllipse($pen, $box)
    $pen.Dispose()
  }
}

# La lueur du bas appartient au fond, pas au symbole : dans le fichier
# d'origine elle deborde du carre et c'est le carre qui la coupe. Elle se
# dessine donc a l'echelle de l'image, jamais a celle du symbole - sinon elle
# se detache en ovale franc au milieu de l'icone au lieu de mourir sur le bord.
function Add-Glow($g) {
  Add-Ellipse $g 90 150 76 42 "#2AA399" 0.18 $null 0
}

# Le symbole lui-meme, dans l'ordre d'empilement du SVG.
function Add-Shapes($g) {
  Add-Ellipse $g 62   86    33.25 33.25 "#2E8B6E" 1.0  "#3DAA88"  1.5
  Add-Ellipse $g 118  86    33.25 33.25 "#2AA399" 1.0  "#3DBFB5"  1.5
  Add-Ellipse $g 95   86    9     30    "#228F80" 0.55 $null      0
  Add-Ellipse $g 90   121   19.75 19.75 "#2E8B6E" 1.0  "#FAF9F6"  2.5
  Add-Ellipse $g 120  42    8     8     "#F17360" 1.0  $null      0
  Add-Ellipse $g 118.5 39.5 2.5   2.5   "#FAF9F6" 0.6  $null      0
}

function New-RoundedSquare([float]$side, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $radius
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc(($side - $d), 0, $d, $d, 270, 90)
  $path.AddArc(($side - $d), ($side - $d), $d, $d, 0, 90)
  $path.AddArc(0, ($side - $d), $d, $d, 90, 90)
  $path.CloseFigure()
  $path
}

<#
.SYNOPSIS
  Ecrit une variante de l'icone.
.PARAMETER Rounded
  Carre arrondi et coins transparents (icones "any" du manifeste). Sinon le
  vert va jusqu'au bord : c'est ce qu'attendent iOS, qui applique son propre
  masque et remplit de noir toute transparence, et les icones "maskable",
  qu'Android recadre comme il veut.
.PARAMETER Inset
  Part du cote laissee libre de chaque cote. Les icones maskables peuvent etre
  rognees jusqu'a la zone sure - le cercle central de 80% - donc le dessin y
  est reduit d'autant.
#>
function Write-Icon([string]$name, [int]$size, [bool]$rounded, [double]$inset) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  # Le fond, et du meme coup la decoupe : carre arrondi aux coins transparents,
  # ou vert jusqu'au bord de l'image.
  $green = New-Object System.Drawing.SolidBrush(New-Color "#1B5E4F")
  $card = if ($rounded) { New-RoundedSquare $size ($size * 40 / 180) }
          else {
            $square = New-Object System.Drawing.Drawing2D.GraphicsPath
            $square.AddRectangle((New-Object System.Drawing.RectangleF(0, 0, $size, $size)))
            $square
          }
  $g.FillPath($green, $card)
  $g.SetClip($card)
  $card.Dispose()
  $green.Dispose()

  $g.ScaleTransform([float]($size / 180), [float]($size / 180))
  Add-Glow $g
  $g.ResetTransform()

  $side = [float]($size * (1 - 2 * $inset))
  $g.TranslateTransform([float]($size * $inset), [float]($size * $inset))
  $g.ScaleTransform([float]($side / 180), [float]($side / 180))
  Add-Shapes $g

  $g.Dispose()
  $path = Join-Path $assets $name
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  "{0,-28} {1}x{1}" -f $name, $size
}

Write-Icon "icon-192.png"           192 $true  0
Write-Icon "icon-512.png"           512 $true  0
Write-Icon "icon-maskable-512.png"  512 $false 0.10
Write-Icon "apple-touch-icon.png"   180 $false 0
