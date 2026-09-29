"""Clusterbereiche fuer FAT und exFAT.

Cluster werden als Bereiche ``(erster_cluster, anzahl)`` gefuehrt, nicht als
Liste einzelner Nummern. Eine beschaedigte Groessenangabe kostet so keinen
Speicher, und eine zusammenhaengende Datei belegt nur einen Eintrag.

Die Funktionen erwarten ein Boot-Objekt mit ``cluster_offset(c)``,
``cluster_size``, ``max_cluster`` und ``valid_cluster(c)``; das bieten
``fat.FatBoot`` und ``exfat.ExfatBoot``.
"""

from __future__ import annotations

from typing import Callable, Iterable, List, Tuple

ClusterRun = Tuple[int, int]


def chain_to_runs(clusters: Iterable[int]) -> List[ClusterRun]:
    """Clusterfolge (z.B. eine FAT-Kette) in Bereiche zusammenfassen."""
    runs: List[ClusterRun] = []
    for cluster in clusters:
        if runs and runs[-1][0] + runs[-1][1] == cluster:
            runs[-1] = (runs[-1][0], runs[-1][1] + 1)
        else:
            runs.append((cluster, 1))
    return runs


def clamp_range(boot, first: int, count: int) -> List[ClusterRun]:
    """``count`` Cluster ab ``first``, begrenzt auf das Volume."""
    if count <= 0 or not boot.valid_cluster(first):
        return []
    count = min(count, boot.max_cluster - first + 1)
    return [(first, count)] if count > 0 else []


def cluster_total(runs: Iterable[ClusterRun]) -> int:
    return sum(count for _start, count in runs)


def byte_runs(boot, runs: Iterable[ClusterRun]) -> List[Tuple[int, int]]:
    """Clusterbereiche als Byte-Bereiche ``(offset, laenge)`` in der Quelle."""
    out: List[Tuple[int, int]] = []
    for start, count in runs:
        offset = boot.cluster_offset(start)
        length = count * boot.cluster_size
        if out and out[-1][0] + out[-1][1] == offset:
            out[-1] = (out[-1][0], out[-1][1] + length)
        else:
            out.append((offset, length))
    return out


def free_runs(is_used: Callable[[int], bool], start: int, needed: int, window: int,
              max_cluster: int) -> Tuple[List[ClusterRun], int, int]:
    """Sammelt ab ``start`` freie Cluster und ueberspringt belegte.

    Gesucht wird hoechstens bis ``start + window`` und bis zum Volumeende.
    Rueckgabe: ``(bereiche, anzahl_gefunden, anzahl_uebersprungen)``.
    """
    runs: List[ClusterRun] = []
    found = 0
    skipped = 0
    cluster = start
    end = min(max_cluster, start + window)
    while found < needed and cluster <= end:
        if is_used(cluster):
            skipped += 1
        else:
            if runs and runs[-1][0] + runs[-1][1] == cluster:
                runs[-1] = (runs[-1][0], runs[-1][1] + 1)
            else:
                runs.append((cluster, 1))
            found += 1
        cluster += 1
    return runs, found, skipped
