# sus-app

Componente independiente que permite inyectar una encuesta para medir la experiencia del usuario a traves de NPS (Net Promote Score) o CEPS (Customer Satisfaction Score)

## Branching strategy

GitFlow se basa en cinco tipos de ramas principales:

| Branch | Descripcion |
|---|---|
| main (producción) | Contiene el código estable y listo para producción.|
| develop (desarrollo) | Rama base donde se integran nuevas funcionalidades antes de ser preparadas para producción.|
| feature/* (nuevas características) | Ramas temporales para desarrollar nuevas funcionalidades.|
| release/* (preparación de versiones) | Para estabilizar una versión antes de pasar a producción.|
| hotfix/* (corrección de errores en producción) | Para corregir errores críticos detectados en main.

## Setup enviroment develpment

Instalar dependenicas
```
npm install
```
Ejecutrar storybook
```
npm run storybook
```


