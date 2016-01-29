/*** AdvancedThermostatDevice Z-Way HA module *******************************************

Version: 1.00
(c) Maroš Kollár, 2015
-----------------------------------------------------------------------------
Author: Maroš Kollár <maros@k-1.com>
Description:
    Implements thermostat device based on temperature sensors and switches
******************************************************************************/

// ----------------------------------------------------------------------------
// --- Class definition, inheritance and setup
// ----------------------------------------------------------------------------

function AdvancedThermostatDevice (id, controller) {
    // Call superconstructor first (AutomationModule)
    AdvancedThermostatDevice.super_.call(this, id, controller);
    
    this.vDevThermostat     = undefined;
    this.vDevSwitch         = undefined;
}

inherits(AdvancedThermostatDevice, BaseModule);

_module = AdvancedThermostatDevice;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------

AdvancedThermostatDevice.prototype.init = function (config) {
    AdvancedThermostatDevice.super_.prototype.init.call(this, config);

    var self = this;

    if (typeof(self.config.thermostat) === 'undefined') {
        self.log('Create thermostat');
        self.vDevThermostat = self.controller.devices.create({
            deviceId: "AdvancedThermostatDevice_Thermostat_" + this.id,
            defaults: {
                metrics: {
                    scaleTitle: self.config.unitTemperature === 'celsius' ? '°C' : '°F',
                    level:      self.config.unitTemperature === 'celsius' ? 18 : 65,
                    min:        self.config.unitTemperature === 'celsius' ? 10 : 50,
                    max:        self.config.unitTemperature === 'celsius' ? 35 : 95,
                    icon:       'thermostat',
                    title:      self.langFile.m_title
                }
            },
            overlay: {
                deviceType: "thermostat"
            },
            handler: function (command, args) {
                if (command === 'exact') {
                    self.log('Setting thermostat to '+args.level);
                    this.set("metrics:level", args.level);
                    self.checkTemp(this);
                }
            },
            moduleId: this.id
        });
    }
    
    if (typeof(self.config.switch) === 'undefined') {
        self.log('Create switch');
        // Create vdev switch
        self.vDevSwitch = self.controller.devices.create({
            deviceId: "AdvancedThermostatDevice_Switch_" + self.id,
            defaults: {
                metrics: {
                    level: 'off',
                    icon: 'thermostat',
                    title: self.langFile.m_title
                },
            },
            overlay: {
                deviceType: 'switchBinary',
                probeType: 'ThermostatController'
            },
            handler: function(command, args) {
                if (command === 'on' || command === 'off') {
                    self.log('Turning '+command+' thermostat');
                    this.set('metrics:level',command);
                    self.checkTemp(this);
                }
            },
            moduleId: this.id
        });
    }
    
    setTimeout(_.bind(self.initCallback,self), 10000);
};

AdvancedThermostatDevice.prototype.initCallback = function() {
    var self = this;
    
    self.callback = _.bind(self.checkTemp,self);
    
    if (typeof(self.config.thermostat) !== 'undefined') {
        self.vDevThermostat = self.controller.devices.get(self.config.thermostat);
        self.vDevThermostat.on('modify:metrics:level',self.callback);
    }
    if (typeof(self.config.switch) !== 'undefined') {
        self.vDevSwitch = self.controller.devices.get(self.config.switch);
        self.vDevSwitch.on('modify:metrics:level',self.callback);
    }
    
    self.processDeviceList(self.config.windowSensors,function(deviceObject) {
        deviceObject.on('modify:metrics:level',self.callback,'window');
    });
    self.processDeviceList(self.config.temperatureSensors,function(deviceObject) {
        deviceObject.on('modify:metrics:level',self.callback);
    });
    
    self.callback();
};

AdvancedThermostatDevice.prototype.stop = function() {
    var self = this;
    
    // Remove bindings
    self.processDeviceList(self.config.windowSensors,function(deviceObject) {
        deviceObject.off('modify:metrics:level',self.callback);
    });
    self.processDeviceList(self.config.temperatureSensors,function(deviceObject) {
        deviceObject.off('modify:metrics:level',self.callback);
    });
    
    // Remove switch
    if (typeof(self.config.switch) === 'undefined') {
        self.controller.devices.remove(self.vDevSwitch.id);
    } else {
        self.vDevSwitch.off('modify:metrics:level',self.callback);
    }
    self.vDevSwitch = null;
    
    // Remove thermostat
    if (typeof(self.config.thermostat) === 'undefined') {
        self.controller.devices.remove(self.vDevThermostat.id);
    } else {
        self.vDevThermostat.off('modify:metrics:level',self.callback);
    }
    self.vDevThermostat = null;
    
    self.callback = undefined;
    
    AdvancedThermostatDevice.super_.prototype.stop.call(this);
};

// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------

AdvancedThermostatDevice.prototype.checkTemp = function(vDev) {
    var self = this;
    
    var currentTemp,target,reason;
    var targetTemp      = parseFloat(self.vDevThermostat.get('metrics:level'));
    var state           = self.vDevSwitch.get('metrics:level');
    var mode            = self.config.mode;
    var hysteresis      = parseFloat(self.config.hysteresis);
    var measurements    = [];
    var windowOpen      = false;
    var now             = Math.floor(new Date().getTime() / 1000);
    var currentLevel    = self.getCurrentLevel();
    var lastOff         = self.vDevSwitch.get('metrics:lastoff') || 0;
    var lastOn          = self.vDevSwitch.get('metrics:laston') || now;
    
    // Get window
    self.processDeviceList(self.config.windowSensors,function(deviceObject) {
        if (deviceObject.get('metrics:level') === 'on') {
            self.log('Window '+deviceObject.get('title')+' is open');
            windowOpen = true;
        }
    });
    
    // Get current temperature from most recent measurement
    self.processDeviceList(self.config.temperatureSensors,function(deviceObject) {
        measurements.push([
            deviceObject.get('updateTime'),
            parseFloat(deviceObject.get('metrics:level')),
            deviceObject
        ]);
    });
    
    // TODO average of all sensors weighted by age 
    measurements.sort(function(a,b) { 
        if (a[0] > b[0]) return -1;
        else if (a[0] <b[0]) return 1;
        return 0;
    });
    currentTemp = measurements[0][1];
    
    if (state === 'off') {
        reason = 'switch';
        target = false;
    // Check windows
    } else if (windowOpen
        && (
            mode === 'cool' || 
            (mode === 'heat' && currentTemp > self.vDevThermostat.get('metrics:min'))
            )
        ) {
        reason = 'open window';
        target = false;
    // Check max time
    } else if (typeof(self.config.maxTime) === 'number'
        && self.config.maxTime > 0
        && currentLevel === true
        && (now - lastOn) > (self.config.maxTime * 60)) {
        reason = 'max time';
        target = false;
    // Check pause time
    } else if (typeof(self.config.pauseTime) === 'number'
        && self.config.pauseTime > 0
        && currentLevel === false
        && (now - lastOff) < (self.config.pauseTime * 60)) {
        reason = 'pause time';
        // target = false;
    // Check setpoint
    } else {
        reason = 'setpoint';
        if (mode === 'heat') {
            if ((currentTemp - hysteresis) >= targetTemp) {
                target = false;
            } else if ((currentTemp + hysteresis) <= targetTemp) {
                target = true;
            }
        } else if (mode === 'cool') {
            if ((currentTemp + hysteresis) <= targetTemp) {
                target = false;
            } else if ((currentTemp - hysteresis) >= targetTemp) {
                target = true;
            }
        }
    }
    
    if (typeof(target) === 'boolean') {
        self.log('Turning thermostat '+(target ? 'on':'off')+' due to '+reason);
        var targetCommand = target ? 'on':'off';
        self.vDevSwitch.set('metrics:last'+targetCommand,now);
        self.processDeviceList(self.config.devices,function(deviceObject) {
            if (deviceObject.get('metrics:level') !== targetCommand) {
                deviceObject.performCommand(targetCommand);
            }
        });
    } else {
        self.log('Keeping thermostat '+(currentLevel ? 'on':'off'));
    }
};

AdvancedThermostatDevice.prototype.getCurrentLevel = function() {
    var self = this;
    
    var currentLevel = false;
    self.processDeviceList(self.config.devices,function(deviceObject) {
        if (deviceObject.get('metrics:level') === 'on') {
            currentLevel = true;
        }
    });
    
    return currentLevel;
};
