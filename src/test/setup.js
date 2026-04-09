import '@testing-library/jest-dom'

// jsdom doesn't implement scrollIntoView — stub it to avoid test errors
window.Element.prototype.scrollIntoView = () => {}
