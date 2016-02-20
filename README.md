# Zway-AdvancedThermostatDevice

This module combines an actor and a temperature sensor to form a thermostat. 
The actor will be turned on off depending on the temperature measured and a 
set-point defined by either a virtual thermostat provided in the config
or alternatively created by this module.

# Configuration

## thermostat

Thermostat device for setpoints. If no device is provided, a virtual 
thermostat will be created.

## switch

Thermostat switch to enable/disable operation. If no device is provided, a 
virtual switch will be created.

## temperatureSensors

Multiple temperature sensors

## windowSensors

Multiple binary sensors (such as window sensors) that temporarily disable
thermostat operation.

## mode

Operation mode: Heat or cool

## hysteresis

Maximal delta between current and target temperature after which thermostat 
should turn on/off

## unitTemperature

Temperature Unit: Metric or imperial

## maxTime, pauseTime

Optional setting (in minutes) for maximum operation time and pauses between
operation.

# Events

No events are emitted

# Virtual Devices

Up to two virtual devices are created.

# Installation

Make sure that the BaseModule is installed prior to installing this module 
( https://github.com/maros/Zway-BaseModule )

```shell
cd /opt/z-way-server/automation/modules
git clone https://github.com/maros/Zway-AdvancedThermostatDevice.git AdvancedThermostatDevice --branch latest
```

To update or install a specific version
```shell
cd /opt/z-way-server/automation/modules/AdvancedThermostatDevice
git fetch --tags
# For latest released version
git checkout tags/latest
# For a specific version
git checkout tags/1.02
# For development version
git checkout -b master --track origin/master
```

Alternatively this module can be installed via the Z-Wave.me app store. Just
go to Management > App Store Access and add 'k1_beta' access token.

# License

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or any 
later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.