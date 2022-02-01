import { open, close, readFile } from "fs";
import { exec } from "child_process";
import cliProgress from "cli-progress";

import Database from "./db.js";

const database = new Database("./data.json");
const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

findRaspberry();

function ResolveAll(promises, onProgress) {
  return new Promise((resolve, reject) => {
    const resolved = [];
    let finished = 0;

    const handleResult = () => {
      finished++;
      onProgress(finished / promises.length);
      if (finished == promises.length) {
        resolve(resolved);
      }
    };

    promises.forEach((promise) => {
      promise
        .then((result) => {
          resolved.push(result);
          handleResult();
        })
        .catch((message) => {
          handleResult();
        });
    });
  });
}

function ping(ip) {
  return new Promise((resolve, reject) => {
    exec(`ping -c 3 ${ip}`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stderr) {
        reject(sterr);
        return;
      }

      setTimeout(() => {
        reject("Timeout");
      }, 4000);

      resolve(ip);
    });
  });
}

function arp(ip) {
  return new Promise((resolve, reject) => {
    exec(
      `arping -c 3 -i wlo1 -U -S 192.168.100.17 ${ip}`,
      (error, stdout, sterr) => {
        if (error) {
          reject(error);
          return;
        }
        if (sterr) {
          reject(sterr);
          return;
        }

        setTimeout(() => {
          reject("Timeout");
        }, 4000);

        const macmatch = stdout.match(
          /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/gm
        );
        if (macmatch && macmatch.length > 0) {
          const mac = macmatch[0];
          const lookup = mac.slice(0, 8).toUpperCase();
          const res = { mac, lookup, ip };
          resolve(res);
          return;
        }
        reject("Bad mac");
        return;
      }
    );
  });
}

function progressBar(fraction) {
  bar1.update(Math.ceil(fraction * 100));
}

async function findRaspberry() {
  const pings = [];
  for (let i = 0; i < 255; i++) {
    pings.push(ping(`192.168.100.${i}`));
  }
  console.log("Resolving ips...");

  bar1.start(100, 0);
  const resolvedIps = await ResolveAll(pings, progressBar);
  const arps = [];
  resolvedIps.forEach((ip) => {
    arps.push(arp(ip));
  });
  bar1.stop();

  console.log("Resolving macs...");

  bar1.start(100, 0);
  const resolvedMacs = await ResolveAll(arps, progressBar);
  bar1.stop();

  console.log("Discovering vendors...");
  bar1.start(100, 0);
  const resolvedVendors = await discoverVendors(resolvedMacs, progressBar);

  bar1.stop();

  console.log(resolvedIps, resolvedMacs, resolvedVendors);
}

function discoverVendors(lookups, onProgress) {
  return new Promise((resolve, reject) => {
    const resolvedVendors = [];

    readFile("./vendors.json", (err, buffer) => {
      const vendors = JSON.parse(buffer.toString());

      vendors.forEach((vendor, i) => {
        lookups.forEach((toLookup) => {
          const { lookup, mac, ip } = toLookup;

          if (vendor.macPrefix.includes(lookup)) {
            resolvedVendors.push({ ...toLookup, vendor: vendor.vendorName });
          }
        });
        onProgress(i / vendors.length);
      });

      resolve(resolvedVendors);
    });
  });
}
