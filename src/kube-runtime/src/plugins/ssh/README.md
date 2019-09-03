# SSH plugin

## Goal
The ssh plugin offers ssh connection between containers. Use ${taskrole}-${index} to connect to other job container. 

## Schema
```yaml
extras:
  com.microsoft.pai.runtimeplugin:
    - plugin: ssh
      parameters:
        jobssh: boolean
        userssh: 
          type: string
          value: string
```
- jobssh: true to enable job container wise ssh, false to disable.
- userssh: currently the userssh type should be system|custom. Type system means the value is a key stored in PAI, and type custom means the value is the string defined in job config. 