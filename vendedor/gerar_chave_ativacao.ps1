param(
  [Parameter(Mandatory = $true)]
  [string]$CodigoRegistro
)

$secret = "PAULO-CFF-ATIVACAO-2026"
$mod = [uint64]4294967291

function Normalize-License([string]$value) {
  if ($null -eq $value) {
    return ""
  }
  return ($value.Trim().ToUpper() -replace "\s+", "")
}

function Get-LicenseNumber([string]$value, [uint64]$seed) {
  $total = [uint64]$seed
  for ($i = 0; $i -lt $value.Length; $i++) {
    $code = [uint64][int][char]$value[$i]
    $total = ($total + ($code * [uint64]($i + 17))) % $mod
    $total = (($total * [uint64]131) + $code) % $mod
  }
  return [uint64]$total
}

function Get-Base36Padded([uint64]$value) {
  $alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  $text = ""
  if ($value -eq 0) {
    $text = "0"
  } else {
    while ($value -gt 0) {
      $resto = [int]($value % 36)
      $text = $alphabet[$resto] + $text
      $value = [math]::Floor($value / 36)
    }
  }
  $text = $text.ToUpper().PadLeft(8, '0')
  if ($text.Length -gt 8) {
    return $text.Substring($text.Length - 8)
  }
  return $text
}

function Get-ActivationKey([string]$registrationCode) {
  $cleaned = Normalize-License $registrationCode
  $part1 = Get-Base36Padded (Get-LicenseNumber "$secret|$cleaned" 7)
  $part2 = Get-Base36Padded (Get-LicenseNumber "$cleaned|$secret" 11)
  $raw = "$part1$part2"
  $groups = @()
  for ($i = 0; $i -lt $raw.Length; $i += 4) {
    $groups += $raw.Substring($i, [Math]::Min(4, $raw.Length - $i))
  }
  return ($groups -join "-")
}

$normalizedCode = Normalize-License $CodigoRegistro
$activationKey = Get-ActivationKey $normalizedCode

Write-Output ""
Write-Output "Codigo de registro: $normalizedCode"
Write-Output "Chave de ativacao: $activationKey"
Write-Output ""
