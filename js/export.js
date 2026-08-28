/**
 * export.js — Export natif GPX / TCX / FIT.
 * coords attendu : [[lat, lon, ele], ...]. segments optionnels pour les séances
 * (effort/récup) sont exportés comme points nommés (GPX) / laps (TCX/FIT).
 */

const RPExport = (() => {

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function xmlEscape(str) {
    return String(str).replace(/[<>&'"]/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
    }[c]));
  }

  // ---------- GPX ----------
  function toGpx(coords, name = 'Parcours RunPlanner', segments = null) {
    const points = coords.map(c =>
      `      <trkpt lat="${c[0]}" lon="${c[1]}">${c[2] != null ? `<ele>${c[2]}</ele>` : ''}</trkpt>`
    ).join('\n');

    let waypoints = '';
    if (segments) {
      let cursor = 0;
      waypoints = segments.map(seg => {
        const mid = seg.coords[Math.floor(seg.coords.length / 2)] || seg.coords[0];
        if (!mid) return '';
        return `  <wpt lat="${mid[0]}" lon="${mid[1]}"><name>${xmlEscape(seg.label)}</name></wpt>`;
      }).join('\n');
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunPlanner" xmlns="http://www.topografix.com/GPX/1/1">
${waypoints}
  <trk>
    <name>${xmlEscape(name)}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>`;
  }

  function exportGpx(coords, name, segments) {
    downloadBlob(`${sanitizeFilename(name)}.gpx`, new Blob([toGpx(coords, name, segments)], { type: 'application/gpx+xml' }));
  }

  // ---------- TCX ----------
  function toTcx(coords, name = 'Parcours RunPlanner', segments = null) {
    const now = new Date().toISOString();
    const laps = segments && segments.length
      ? segments.map(seg => tcxLap(seg, now)).join('\n')
      : tcxLap({ coords, distanceM: 0, type: 'variant' }, now);

    return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Courses>
    <Course>
      <Name>${xmlEscape(name)}</Name>
${laps}
    </Course>
  </Courses>
</TrainingCenterDatabase>`;
  }

  function tcxLap(seg, timeIso) {
    const trackpoints = seg.coords.map(c => `        <Trackpoint>
          <Position><LatitudeDegrees>${c[0]}</LatitudeDegrees><LongitudeDegrees>${c[1]}</LongitudeDegrees></Position>
          ${c[2] != null ? `<AltitudeMeters>${c[2]}</AltitudeMeters>` : ''}
        </Trackpoint>`).join('\n');
    return `      <Lap StartTime="${timeIso}">
        <DistanceMeters>${Math.round(seg.distanceM || 0)}</DistanceMeters>
        <Intensity>${seg.type === 'recovery' ? 'Resting' : 'Active'}</Intensity>
        <Track>
${trackpoints}
        </Track>
      </Lap>`;
  }

  function exportTcx(coords, name, segments) {
    downloadBlob(`${sanitizeFilename(name)}.tcx`, new Blob([toTcx(coords, name, segments)], { type: 'application/vnd.garmin.tcx+xml' }));
  }

  // ---------- FIT (binaire, encodeur minimal mais conforme au protocole FIT) ----------
  // Références de spec utilisées : header 12 octets, définitions de message locales,
  // CRC-16 FIT, messages globaux file_id(0), course(31), lap(19), record(20), event(21).

  const FIT_EPOCH = Date.UTC(1989, 11, 31, 0, 0, 0) / 1000; // secondes

  function fitTimestamp(date) {
    return Math.floor(date.getTime() / 1000 - FIT_EPOCH);
  }

  function fitSemicircles(deg) {
    return Math.round(deg * (Math.pow(2, 31) / 180));
  }

  class FitWriter {
    constructor() {
      this.bytes = [];
    }
    u8(v) { this.bytes.push(v & 0xff); }
    u16(v) { this.bytes.push(v & 0xff, (v >> 8) & 0xff); }
    u32(v) { this.bytes.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff); }
    i32(v) { this.u32(v >>> 0); }
    str(s, len) {
      const bytes = new TextEncoder().encode(s);
      for (let i = 0; i < len; i++) this.u8(i < bytes.length ? bytes[i] : 0);
    }
    toUint8Array() { return new Uint8Array(this.bytes); }
  }

  function crc16(bytes) {
    const table = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
      0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400];
    let crc = 0;
    for (const b of bytes) {
      let byte = b;
      let tmp = table[crc & 0xF];
      crc = (crc >> 4) & 0x0FFF;
      crc = crc ^ tmp ^ table[byte & 0xF];
      tmp = table[crc & 0xF];
      crc = (crc >> 4) & 0x0FFF;
      crc = crc ^ tmp ^ table[(byte >> 4) & 0xF];
    }
    return crc & 0xFFFF;
  }

  function defMsg(w, localType, globalNum, fields) {
    // Message de définition : header(1) + reserved(1) + arch(1) + globalNum(2) + numFields(1) + fields(3*n)
    w.u8(0x40 | localType); // header: bit6=definition
    w.u8(0); // reserved
    w.u8(0); // little endian
    w.u16(globalNum);
    w.u8(fields.length);
    fields.forEach(f => { w.u8(f.num); w.u8(f.size); w.u8(f.base); });
  }

  function buildCourseFit(coords, name, segments) {
    const w = new FitWriter();
    const now = new Date();
    const ts0 = fitTimestamp(now);

    // -- file_id (local type 0) --
    defMsg(w, 0, 0, [
      { num: 0, size: 1, base: 0x00 }, // type (enum)
      { num: 1, size: 2, base: 0x84 }, // manufacturer (uint16)
      { num: 4, size: 4, base: 0x86 }, // time_created (uint32)
    ]);
    w.u8(0x00); w.u8(6); // header data msg
    w.u8(6); w.u16(255); w.u32(ts0); // type=course(6), manufacturer=dev(255)

    // -- course (local type 1) --
    defMsg(w, 1, 31, [
      { num: 5, size: 16, base: 0x07 }, // name (string)
    ]);
    w.u8(0x01);
    w.str(name || 'RunPlanner', 16);

    // -- record definition (local type 2) --
    defMsg(w, 2, 20, [
      { num: 253, size: 4, base: 0x86 }, // timestamp
      { num: 0, size: 4, base: 0x85 },   // position_lat (sint32)
      { num: 1, size: 4, base: 0x85 },   // position_long (sint32)
      { num: 2, size: 2, base: 0x84 },   // altitude (uint16, scale 5, offset 500)
      { num: 5, size: 4, base: 0x86 },   // distance (uint32, scale 100)
    ]);

    let cumDist = 0;
    for (let i = 0; i < coords.length; i++) {
      const c = coords[i];
      if (i > 0) {
        cumDist += RPRouting.haversine({ lat: coords[i - 1][0], lon: coords[i - 1][1] }, { lat: c[0], lon: c[1] });
      }
      w.u8(0x02); // record header, local type 2
      w.u32(ts0 + i);
      w.i32(fitSemicircles(c[0]));
      w.i32(fitSemicircles(c[1]));
      const ele = c[2] != null ? c[2] : 0;
      w.u16(Math.round((ele + 500) * 5));
      w.u32(Math.round(cumDist * 100));
    }

    // -- lap messages (local type 3), un par segment si fourni --
    if (segments && segments.length) {
      defMsg(w, 3, 19, [
        { num: 253, size: 4, base: 0x86 },
        { num: 9, size: 4, base: 0x86 }, // total_distance (uint32, scale 100)
      ]);
      segments.forEach((seg, i) => {
        w.u8(0x03);
        w.u32(ts0 + i);
        w.u32(Math.round((seg.distanceM || 0) * 100));
      });
    }

    const payload = w.toUint8Array();

    // -- header --
    const header = new FitWriter();
    header.u8(12); // header size
    header.u8(0x10); // protocol version
    header.u16(2172); // profile version
    header.u32(payload.length); // data size
    header.str('.FIT', 4);
    const headerBytes = header.toUint8Array();
    const headerCrc = crc16(headerBytes);
    const headerCrcBytes = new Uint8Array([headerCrc & 0xff, (headerCrc >> 8) & 0xff]);

    const fullNoCrc = new Uint8Array(headerBytes.length + payload.length);
    fullNoCrc.set(headerBytes, 0);
    fullNoCrc.set(payload, headerBytes.length);
    const fileCrc = crc16(fullNoCrc);
    const fileCrcBytes = new Uint8Array([fileCrc & 0xff, (fileCrc >> 8) & 0xff]);

    const out = new Uint8Array(fullNoCrc.length + 2);
    out.set(fullNoCrc, 0);
    out.set(fileCrcBytes, fullNoCrc.length);
    return out;
  }

  function exportFit(coords, name, segments) {
    try {
      const bytes = buildCourseFit(coords, name, segments);
      downloadBlob(`${sanitizeFilename(name)}.fit`, new Blob([bytes], { type: 'application/octet-stream' }));
    } catch (e) {
      RPDiag.log('error', 'Export FIT échoué: ' + e.message);
      alert("L'export FIT a échoué. Essayez GPX ou TCX en alternative.");
    }
  }

  function sanitizeFilename(name) {
    return (name || 'parcours').normalize('NFKD').replace(/[^\w\-]+/g, '_').slice(0, 60);
  }

  return { exportGpx, exportTcx, exportFit, toGpx, toTcx };
})();
